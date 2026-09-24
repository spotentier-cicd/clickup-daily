import { homedir } from 'node:os'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, join, relative, resolve, sep } from 'node:path'
import { createInterface } from 'node:readline'
import app from '@adonisjs/core/services/app'
import { DateTime } from 'luxon'
import { buildClaudeUsage } from '#domain/claude/aggregate'
import { costOf, emptyUsage, normalizeModel } from '#domain/claude/pricing'
import { refsIn } from '#domain/task/ref'
import type { ClaudeEntry } from '#domain/claude/aggregate'
import type { TokenUsage } from '#domain/claude/pricing'
import type { ClaudeUsage } from '#domain/claude/types'
import type { ClaudeConfig } from '#domain/config/types'

/*
| CE QUE LES CONVERSATIONS ONT COÛTÉ.
|
| L'abonnement est individuel : l'API d'administration d'Anthropic est fermée
| aux comptes individuels, et rien n'expose la consommation d'un abonnement
| Pro/Max. La seule source est donc locale — les transcriptions que Claude Code
| écrit dans ~/.claude/projects.
|
| Ce service ne fait que lire et dépouiller ; toute la tarification vit dans
| app/domain/claude. Il ne conserve jamais le texte d'une conversation : il en
| extrait les références de tickets et jette le reste.
|
| Une panne ici ne doit pas coûter le rapport du matin : l'appelant reçoit null.
*/

export interface ClaudeUsageLogger {
  debug: (message: string) => void
  info: (message: string) => void
}

export interface CollectClaudeOptions {
  config: ClaudeConfig
  zone: string
  now: DateTime
  logger: ClaudeUsageLogger
  /**
   * Préfixes de tickets réellement connus (« roc », « rocnd »).
   *
   * Sans eux, chercher une référence dans du texte libre ramène n'importe
   * quoi : « GPT-4 », « Opus-5 », le segment d'une URL. Une référence n'est
   * retenue que si son préfixe existe vraiment dans le workspace ClickUp.
   * Vide, le filtre ne s'applique pas — les noms de branches, eux, sont assez
   * contraints pour s'en passer.
   */
  knownPrefixes?: string[]
}

/**
 * Un relevé replié : tout ce qu'un modèle a consommé un jour donné, dans un
 * fichier donné, pour un même jeu de tickets.
 *
 * C'est la forme mise en cache. Elle pèse quelques dizaines de lignes là où le
 * fichier en compte des milliers, et elle suffit au calcul.
 */
type Bucket = {
  day: string
  model: string
  speed?: string
  refs: string[]
  usage: TokenUsage
}

type FileDigest = {
  /** Taille et date de dernière écriture : ce qui change quand le fichier change. */
  signature: string
  sessionId: string
  buckets: Bucket[]
  /**
   * Ce que Claude Code a lui-même inscrit dans le fichier, quand il l'a fait.
   * Ne sert PAS au calcul — c'est au niveau de la session entière, donc
   * indécoupable par mois ou par ticket. Sert d'étalon : voir `verify()`.
   */
  costState?: CostState
}

type CostState = {
  total: number
  models: Record<string, ReferenceUsage>
}

/** Les compteurs tels que Claude Code les écrit, avec le prix qu'il en tire. */
export type ReferenceUsage = {
  input: number
  output: number
  cacheRead: number
  cacheCreation: number
  webSearches: number
  usd: number
}

/** Ce que la grille annonce face à ce que Claude Code a facturé, à tokens égaux. */
export type PricingCheck = {
  session: string
  model: string
  ours: number | null
  theirs: number
}

/** Ce que les transcriptions laissent voir, face au coût réel de la conversation. */
export type CoverageCheck = {
  session: string
  ours: number
  theirs: number
  files: number
}

/** Au-delà, on ne cherche plus de référence : un résultat d'outil n'est pas un prompt. */
const MAX_SCANNED_CHARS = 20_000

/**
 * À incrémenter dès que la forme d'un relevé change.
 *
 * Le cache est indexé par signature de fichier : sans ce numéro, un fichier
 * inchangé ressortirait dans l'ancienne forme après une évolution du code.
 */
const CACHE_VERSION = 1

export class ClaudeUsageService {
  async collect(options: CollectClaudeOptions): Promise<ClaudeUsage | null> {
    const { config, zone, now, logger } = options
    const root = expandHome(process.env.CLAUDE_TRANSCRIPTS_PATH || config.transcriptsPath)

    const files = await this.#transcripts(root, config.includeSubagents)
    if (files === null) {
      logger.debug(`Transcriptions Claude introuvables : ${root}`)
      return null
    }

    const since = now.startOf('month')
    const until = since.plus({ months: 1 })

    const prefixes = new Set(options.knownPrefixes ?? [])
    const cache = await this.#readCache(root)
    const fresh: Record<string, FileDigest> = {}
    const entries: ClaudeEntry[] = []
    let read = 0

    for (const file of files) {
      const info = await stat(file).catch(() => null)
      if (!info) continue

      /*
       * Un fichier dont la dernière écriture précède le début du mois ne peut
       * pas contenir de ligne du mois. C'est ce qui garde la collecte rapide
       * quand l'historique grossit — ici, 128 Mo dont l'essentiel est ancien.
       */
      if (DateTime.fromMillis(info.mtimeMs) < since) continue

      const signature = `${info.size}:${Math.round(info.mtimeMs)}`
      let digest = cache[file]

      if (!digest || digest.signature !== signature) {
        digest = await this.#digest(file, signature, zone, config.scanMessageText)
        read++
      }

      fresh[file] = digest
      for (const bucket of digest.buckets) {
        const at = DateTime.fromISO(bucket.day, { zone })
        if (!at.isValid) continue

        entries.push({
          at,
          model: bucket.model,
          speed: bucket.speed,
          usage: bucket.usage,
          /* Filtré ici et non au dépouillement : le cache ne dépend pas du périmètre. */
          refs: prefixes.size
            ? bucket.refs.filter((ref) => prefixes.has(ref.split('-')[0]))
            : bucket.refs,
          sessionId: digest.sessionId,
        })
      }
    }

    await this.#writeCache(root, fresh)

    const usage = buildClaudeUsage(entries, { since, until, now })
    logger.info(
      `Claude : ${usage.totalUsd.toFixed(2)} $ équivalent API depuis le 1er du mois ` +
        `(${usage.sessions} conversations, ${read} fichiers relus)`
    )
    if (usage.unknownModels.length) {
      logger.info(`Modèles absents de la grille tarifaire : ${usage.unknownModels.join(', ')}`)
    }

    return usage
  }

  /**
   * Confronte notre travail à ce que Claude Code a écrit lui-même.
   *
   * Deux questions bien distinctes, que mélanger rendait l'exercice illisible.
   *
   * LA GRILLE : on reprend LEURS compteurs de tokens et on leur applique NOTRE
   * grille ; le résultat doit retomber sur LEUR montant. Rien ne dépend ici de
   * notre lecture des fichiers, donc un écart ne peut venir que d'un tarif
   * faux. C'est l'assertion dure.
   *
   * LA COUVERTURE : notre total reconstitué depuis les transcriptions, comparé
   * au leur. Il manque toujours quelques pour cent, et toujours dans le même
   * sens — Claude Code facture des appels auxiliaires (le titre d'une
   * conversation, en Haiku) qu'il n'écrit pas comme des réponses. C'est une
   * mesure, pas une alerte.
   */
  async verify(
    config: ClaudeConfig,
    zone: string
  ): Promise<{ pricing: PricingCheck[]; coverage: CoverageCheck[] }> {
    const root = expandHome(process.env.CLAUDE_TRANSCRIPTS_PATH || config.transcriptsPath)
    const files = await this.#transcripts(root, true)
    if (files === null) return { pricing: [], coverage: [] }

    const cache = await this.#readCache(root)
    const fresh: Record<string, FileDigest> = {}

    for (const file of files) {
      const info = await stat(file).catch(() => null)
      if (!info) continue

      const signature = `${info.size}:${Math.round(info.mtimeMs)}`
      const digest = cache[file]
      fresh[file] =
        digest && digest.signature === signature
          ? digest
          : await this.#digest(file, signature, zone, config.scanMessageText)
    }

    await this.#writeCache(root, fresh)

    const pricing: PricingCheck[] = []
    const coverage: CoverageCheck[] = []

    for (const [file, digest] of Object.entries(fresh)) {
      if (!digest.costState) continue
      /* Une conversation est un fichier directement sous son projet ; le reste est sous-agent. */
      if (relative(root, file).split(sep).length !== 2) continue

      const session = basename(file)

      /*
       * Tous les fichiers de la conversation : le parent et ses sous-agents.
       * Leur ventilation par modèle couvre l'ensemble, la nôtre doit donc en
       * faire autant — sans quoi la proportion d'écritures de cache est lue
       * sur un échantillon qui n'est pas le bon.
       */
      const branch = `${file.slice(0, -'.jsonl'.length)}${sep}`
      const conversation = Object.entries(fresh)
        .filter(([other]) => other === file || other.startsWith(branch))
        .map(([, entry]) => entry)

      for (const [model, theirs] of Object.entries(digest.costState.models)) {
        if (theirs.usd === 0) continue

        /*
         * Leur ventilation ne dit pas la durée de vie des écritures de cache,
         * qui n'ont pas le même prix. On reprend la proportion observée dans
         * nos propres relevés pour ce modèle ; à défaut, le cache long, qui
         * est ce que Claude Code utilise.
         */
        const ratio1h = this.#cacheRatio(conversation, model)
        const ours = costOf(
          {
            input: theirs.input,
            output: theirs.output,
            cacheRead: theirs.cacheRead,
            cacheWrite1h: theirs.cacheCreation * ratio1h,
            cacheWrite5m: theirs.cacheCreation * (1 - ratio1h),
            webSearches: theirs.webSearches,
          },
          model
        )

        pricing.push({ session, model, ours, theirs: theirs.usd })
      }

      /* Le coût d'une conversation englobe ses sous-agents, qui ont leurs propres fichiers. */
      let ours = 0
      for (const entry of conversation) {
        for (const bucket of entry.buckets) {
          ours += costOf(bucket.usage, bucket.model, bucket.speed) ?? 0
        }
      }

      coverage.push({
        session,
        ours,
        theirs: digest.costState.total,
        files: conversation.length,
      })
    }

    return { pricing, coverage }
  }

  /** Part des écritures de cache longue durée, observée sur ce modèle. */
  #cacheRatio(digests: FileDigest[], model: string): number {
    let long = 0
    let short = 0
    for (const digest of digests) {
      for (const bucket of digest.buckets) {
        if (normalizeModel(bucket.model) !== normalizeModel(model)) continue
        long += bucket.usage.cacheWrite1h
        short += bucket.usage.cacheWrite5m
      }
    }

    return long + short === 0 ? 1 : long / (long + short)
  }

  /** Les fichiers de transcription, ou null si la racine n'existe pas. */
  async #transcripts(root: string, includeSubagents: boolean): Promise<string[] | null> {
    const found: string[] = []

    const walk = async (directory: string): Promise<void> => {
      const items = await readdir(directory, { withFileTypes: true }).catch(() => [])
      for (const item of items) {
        const path = join(directory, item.name)
        if (item.isDirectory()) {
          await walk(path)
        } else if (item.name.endsWith('.jsonl')) {
          if (!includeSubagents && path.includes(`${sep}subagents${sep}`)) continue
          found.push(path)
        }
      }
    }

    const info = await stat(root).catch(() => null)
    if (!info?.isDirectory()) return null

    await walk(root)
    return found
  }

  /**
   * Dépouille un fichier.
   *
   * Deux pièges, tous deux vérifiés sur de vraies transcriptions :
   *
   * - Claude Code écrit UNE LIGNE PAR BLOC de contenu d'une même réponse API
   *   (réflexion, texte, appel d'outil), en recopiant le même `usage` à chaque
   *   fois. Sans dédoublonnage par identifiant de message, le montant double.
   * - Les écritures de cache ont deux tarifs selon leur durée de vie ;
   *   `cache_creation_input_tokens` n'en est que la somme, et s'en servir seul
   *   fausse le calcul.
   */
  async #digest(
    file: string,
    signature: string,
    zone: string,
    scanText: boolean
  ): Promise<FileDigest> {
    const seen = new Set<string>()
    const buckets = new Map<string, Bucket>()
    const refsByDay = new Map<string, Set<string>>()
    let sessionId = ''
    let costState: CostState | undefined

    const lines = createInterface({
      input: createReadStream(file, { encoding: 'utf8' }),
      crlfDelay: Number.POSITIVE_INFINITY,
    })

    for await (const line of lines) {
      if (!line.trim()) continue

      let row: Record<string, unknown>
      try {
        row = JSON.parse(line)
      } catch {
        continue /* Une ligne tronquée ne condamne pas le fichier. */
      }

      if (!sessionId && typeof row.sessionId === 'string') sessionId = row.sessionId

      /* Les lignes cost-state sont dupliquées à l'identique : la dernière fait foi. */
      if (row.type === 'cost-state' && typeof row.totalCostUSD === 'number') {
        costState = { total: row.totalCostUSD, models: referenceModels(row.modelUsage) }
        continue
      }

      const at = typeof row.timestamp === 'string' ? DateTime.fromISO(row.timestamp) : null
      const day = at?.isValid ? at.setZone(zone).toISODate() : null
      if (!day) continue

      const refs = refsByDay.get(day) ?? new Set<string>()
      refsByDay.set(day, refs)

      if (typeof row.gitBranch === 'string') {
        for (const ref of refsIn(row.gitBranch)) refs.add(ref)
      }

      const message = row.message as Record<string, unknown> | undefined
      if (!message) continue

      if (row.type === 'user' && scanText) {
        for (const ref of refsIn(textOf(message.content))) refs.add(ref)
        continue
      }

      if (row.type !== 'assistant') continue

      const id = typeof message.id === 'string' ? message.id : null
      const usage = message.usage as Record<string, unknown> | undefined
      if (!id || !usage || seen.has(id)) continue
      seen.add(id)

      const model = typeof message.model === 'string' ? message.model : ''
      const speed = typeof usage.speed === 'string' ? usage.speed : undefined
      const key = `${day}|${model}|${speed ?? ''}`

      const bucket = buckets.get(key) ?? { day, model, speed, refs: [], usage: emptyUsage() }
      bucket.usage = addInto(bucket.usage, usage)
      buckets.set(key, bucket)
    }

    /* Les tickets d'une journée valent pour tout ce qui a été consommé ce jour-là. */
    const digested = [...buckets.values()].map((bucket) => ({
      ...bucket,
      refs: [...(refsByDay.get(bucket.day) ?? [])],
    }))

    return { signature, sessionId: sessionId || file, buckets: digested, costState }
  }

  async #readCache(root: string): Promise<Record<string, FileDigest>> {
    try {
      const cached = JSON.parse(await readFile(this.#cachePath(root), 'utf8'))
      return cached?.version === CACHE_VERSION ? cached.files : {}
    } catch {
      return {}
    }
  }

  /** Les fichiers disparus sortent du cache : il ne grossit pas indéfiniment. */
  async #writeCache(root: string, digests: Record<string, FileDigest>): Promise<void> {
    try {
      await mkdir(app.tmpPath('claude'), { recursive: true })
      await writeFile(
        this.#cachePath(root),
        JSON.stringify({ version: CACHE_VERSION, files: digests }),
        'utf8'
      )
    } catch {
      /* Un cache qui ne s'écrit pas coûte du temps, pas un rapport. */
    }
  }

  /**
   * Un cache par racine.
   *
   * Le chemin monté dans un conteneur et celui du poste ne décrivent pas la
   * même arborescence ; ils ne doivent pas se partager un index, sous peine de
   * s'effacer mutuellement à chaque exécution.
   */
  #cachePath(root: string): string {
    const key = createHash('sha1').update(root).digest('hex').slice(0, 12)
    return app.tmpPath('claude', `transcripts-${key}.json`)
  }
}

/** Le texte d'un message, qu'il soit une chaîne ou un tableau de blocs. */
function textOf(content: unknown): string {
  if (typeof content === 'string') return content.slice(0, MAX_SCANNED_CHARS)
  if (!Array.isArray(content)) return ''

  const parts: string[] = []
  for (const block of content) {
    if (
      block &&
      typeof block === 'object' &&
      typeof (block as { text?: unknown }).text === 'string'
    ) {
      parts.push((block as { text: string }).text)
    }
  }

  return parts.join('\n').slice(0, MAX_SCANNED_CHARS)
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function addInto(total: TokenUsage, usage: Record<string, unknown>): TokenUsage {
  const creation = usage.cache_creation as Record<string, unknown> | undefined
  const tools = usage.server_tool_use as Record<string, unknown> | undefined

  /* Sans le détail par durée de vie, tout retombe sur le cache court, qui est le défaut. */
  const write5m = creation
    ? count(creation.ephemeral_5m_input_tokens)
    : count(usage.cache_creation_input_tokens)
  const write1h = creation ? count(creation.ephemeral_1h_input_tokens) : 0

  return {
    input: total.input + count(usage.input_tokens),
    output: total.output + count(usage.output_tokens),
    cacheRead: total.cacheRead + count(usage.cache_read_input_tokens),
    cacheWrite5m: total.cacheWrite5m + write5m,
    cacheWrite1h: total.cacheWrite1h + write1h,
    webSearches: total.webSearches + count(tools?.web_search_requests),
  }
}

function expandHome(path: string): string {
  return resolve(path.startsWith('~') ? join(homedir(), path.slice(1)) : path)
}

/** La ventilation par modèle d'une ligne cost-state, nettoyée. */
function referenceModels(raw: unknown): Record<string, ReferenceUsage> {
  if (!raw || typeof raw !== 'object') return {}

  const models: Record<string, ReferenceUsage> = {}
  for (const [model, value] of Object.entries(raw as Record<string, unknown>)) {
    const entry = value as Record<string, unknown>
    models[model] = {
      input: count(entry.inputTokens),
      output: count(entry.outputTokens),
      cacheRead: count(entry.cacheReadInputTokens),
      cacheCreation: count(entry.cacheCreationInputTokens),
      webSearches: count(entry.webSearchRequests),
      usd: count(entry.costUSD),
    }
  }

  return models
}
