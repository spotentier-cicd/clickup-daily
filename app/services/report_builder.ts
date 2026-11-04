import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import { ClickUpClient } from '#clickup/client'
import { mapWithConcurrency } from '#clickup/rate_limiter'
import { ClickUpError } from '#clickup/errors'
import { branchesForTask, GitService } from '#services/git_service'
import { VeilleService } from '#services/veille_service'
import { ClaudeUsageService } from '#services/claude_usage_service'
import { ClickupCacheRepository, REVALIDATE_AFTER_HOURS } from '#services/clickup_cache_repository'
import { buildColumns } from '#domain/task/columns'
import { toTaskView } from '#domain/task/view'
import { buildPointage } from '#domain/rules/pointage'
import { computeBlockers } from '#domain/rules/blockers'
import { computeDiff, toSnapshot } from '#domain/rules/diff'
import { followedListIds, followedStatuses, isTaskInScope, resolveTeam } from '#domain/scope'
import { commentText, displayTargets, findMentions, mentionTargets } from '#domain/mention/comments'
import { asInt, msToDateTime } from '#domain/time'
import type { Report, ReportStats, TaskComment } from '#domain/report'
import type { TaskView } from '#domain/task/types'
import type { TaskSnapshot } from '#domain/rules/diff'
import type { RawComment } from '#domain/mention/comments'
import type { ClickUpDailyConfig } from '#domain/config/types'
import type { ScopePreferences } from '#domain/scope'
import type { GitBranch } from '#domain/git/types'

export interface BuildLogger {
  debug: (message: string) => void
  info: (message: string) => void
  warn: (message: string) => void
}

export interface BuildReportOptions {
  config: ClickUpDailyConfig
  client: ClickUpClient
  logger: BuildLogger
  /** Espaces à interroger, choisis dans la page de paramétrage. */
  scope: ScopePreferences
  now?: DateTime
  /** Run précédent, pour « ce qui a changé ». */
  previous?: { at: DateTime; tasks: TaskSnapshot[] } | null
  skip?: {
    temps?: boolean
    git?: boolean
    mentions?: boolean
    enrich?: boolean
    veille?: boolean
    claude?: boolean
  }
}

/*
| Ce qu'une collecte s'autorise à relire par run, en plus de ce qui a changé.
|
| Le cache des commentaires et des statuts de sortie se fie à la date de
| modification des tâches. Pour rattraper ce qu'elle ne voit pas, on relit les
| entrées les plus anciennes par petits lots : jamais assez pour retomber dans
| le quota, assez pour que tout soit revu en quelques collectes.
*/
const REVALIDATE_PER_RUN = 20
const EXIT_LOOKUPS_PER_RUN = 30

/**
 * Orchestration : collecte, puis domaine, puis Report.
 *
 * Tout ce qui est calcul vit dans app/domain ; ce service ne fait que des
 * appels et du câblage. Ce qui ne dépend pas l'un de l'autre part en même
 * temps — le limiteur de débit partagé garantit qu'on reste sous le quota de
 * ClickUp — et chaque étape dit ce qu'elle a coûté, pour qu'une collecte
 * lente se lise dans le journal plutôt qu'au chronomètre.
 */
@inject()
export class ReportBuilder {
  constructor(
    private readonly git: GitService,
    private readonly veille: VeilleService,
    private readonly claude: ClaudeUsageService,
    private readonly cache: ClickupCacheRepository
  ) {}

  async build(options: BuildReportOptions): Promise<Report> {
    const { config, client, logger, scope, previous = null, skip = {} } = options
    const startedAt = Date.now()
    const now = options.now ?? DateTime.now().setZone(config.timezone)
    const timed = stageTimer(logger)

    /*
     * Rien n'est écrit en dur : le jeton donne l'utilisateur et ses équipes.
     * C'est ce qui rend le projet utilisable tel quel par quelqu'un d'autre.
     */
    const teams = await client.teams()
    const team = resolveTeam(teams, scope, process.env.CLICKUP_TEAM_ID)
    if (!team) {
      throw new ClickUpError('Ce jeton ClickUp ne donne accès à aucune équipe.')
    }
    const teamId = team.id

    /* Trois lectures qui ne dépendent pas l'une de l'autre : un aller-retour. */
    const [me, taskTypeNames, spaces] = await timed('Préambule', () =>
      Promise.all([client.me(), client.customItemTypes(teamId), client.spaces(teamId)])
    )
    const meUserId = asInt(me.id)
    if (!meUserId) {
      throw new ClickUpError('ClickUp n’a pas rendu d’identifiant pour ce jeton.')
    }
    const meName = me.username ?? ''
    logger.info(`Équipe ${team.name} · utilisateur ${meName || meUserId}`)

    const columns = buildColumns(config.columns)

    /*
     * Le périmètre est une liste de LISTES, pas d'espaces : c'est le niveau où
     * ClickUp définit les statuts, donc le seul où « je veux voir nouveau ici
     * mais pas là » ait un sens. On n'interroge que ce qui est coché.
     */
    const listIds = followedListIds(scope)
    const statuses = followedStatuses(scope)
    logger.info(
      `Périmètre : ${listIds.length} liste${listIds.length > 1 ? 's' : ''}, ` +
        `${statuses.length} statut${statuses.length > 1 ? 's' : ''}`
    )

    if (listIds.length === 0) {
      logger.warn('Aucune liste suivie : ouvrez /parametres pour choisir ce qu’on collecte.')
    }

    /* Les noms d'espaces : les tâches ne portent que leur identifiant. */
    const spaceNames = new Map(spaces.map((space) => [space.id, space.name]))

    const raw = await timed('Tâches', () => client.teamTasks(teamId, listIds, statuses))

    const tasks: TaskView[] = []
    const seen = new Set<string>()
    const kept = new Map<string, number>()
    let outOfScope = 0

    for (const rawTask of raw) {
      if (seen.has(String(rawTask.id))) continue

      /*
       * L'API a filtré sur l'UNION des statuts suivis ; le tri fin se fait
       * ici, liste par liste. Une tâche « nouveau » dans une liste où seul
       * « dev en cours » est coché ressort donc à ce point.
       */
      const listId = String(rawTask.list?.id ?? '')
      if (!isTaskInScope({ listId, status: rawTask.status?.status ?? '' }, scope)) {
        outOfScope++
        continue
      }

      const spaceId = String(rawTask.space?.id ?? '')
      const task = toTaskView({
        raw: rawTask,
        space: { key: spaceId, label: spaceNames.get(spaceId) ?? spaceId },
        columns,
        mapping: scope.columns,
        config,
        meUserId,
        now,
        taskTypeNames,
      })

      seen.add(task.id)
      tasks.push(task)
      kept.set(spaceId, (kept.get(spaceId) ?? 0) + 1)
    }

    /* Les espaces réellement représentés, dans l'ordre où ClickUp les rend. */
    const environments = spaces
      .filter((space) => kept.has(space.id))
      .map((space) => ({ key: space.id, label: space.name }))

    for (const environment of environments) {
      logger.info(`${environment.label} : ${kept.get(environment.key)} tâches`)
    }
    if (outOfScope) {
      logger.info(`${outOfScope} écartées : statut non coché pour leur liste`)
    }

    /*
     * Tout ce qui suit ne dépend que des tâches : l'API, le disque et des flux
     * RSS n'ont aucune raison de s'attendre. Chaque étape encaisse ses propres
     * erreurs — une veille injoignable ne retarde ni ne fait tomber le reste.
     */
    const [pointage, branches, veille, claude, { comments, mentions }, exitStatuses] =
      await Promise.all([
        skip.temps
          ? null
          : timed('Pointage', () => this.#loadPointage(client, teamId, config, now, logger)),
        timed('Branches', () => this.#loadBranches(config, tasks, logger, skip.git)),
        timed('Veille', () =>
          this.#loadVeille(config, now, previous?.at ?? null, logger, skip.veille)
        ),
        timed('Claude', () => this.#loadClaude(config, now, tasks, logger, skip.claude)),
        timed('Commentaires', () =>
          this.#loadComments({
            client,
            config,
            tasks,
            meUserId,
            meName,
            now,
            since: previous?.at ?? null,
            logger,
            skip,
          })
        ),
        timed('Sorties', () => this.#exitStatuses(client, previous, tasks, now, logger)),
      ])

    if (pointage) {
      for (const task of tasks) task.myTimeMs = pointage.byTask[task.id] ?? 0
    }

    const diff = computeDiff({ previous, current: tasks, meUserId, exitStatuses })

    const blockers = computeBlockers({
      tasks,
      config: config.blockers,
      staleAfterDays: config.staleAfterDays,
      now,
      mentions,
      branchesByTask: branches,
    })

    const stats: ReportStats = {
      total: tasks.length,
      mine: tasks.filter((task) => task.isMine).length,
      bugs: tasks.filter((task) => task.isBug).length,
      outOfScope,
      apiCalls: client.requestCount,
      durationMs: Date.now() - startedAt,
    }
    logger.info(
      `${stats.total} tâches (${stats.mine} à moi, ${stats.bugs} bugs) · ` +
        `${stats.apiCalls} appels · ${(stats.durationMs / 1000).toFixed(1)} s`
    )

    return {
      generatedAt: now,
      timezone: config.timezone,
      me: { id: meUserId, name: meName },
      environments,
      columns,
      tasks,
      comments,
      branches,
      mentions,
      blockers,
      pointage,
      veille,
      claude,
      diff,
      stats,
      thresholds: {
        staleAfterDays: config.staleAfterDays,
        reviewWaitDays: config.blockers.reviewWaitDays,
        recetteWaitDays: config.blockers.recetteWaitDays,
        targetHoursPerDay: config.temps.targetHoursPerDay,
        mentionsLookbackDays: config.mentions.lookbackDays,
      },
    }
  }

  async #loadPointage(
    client: ClickUpClient,
    teamId: string,
    config: ClickUpDailyConfig,
    now: DateTime,
    logger: BuildLogger
  ) {
    if (!config.temps.enabled) return null

    const start = now.minus({ days: config.temps.lookbackDays })
    try {
      const entries = await client.timeEntries(teamId, start.toMillis(), now.toMillis())
      logger.info(
        `Pointage : ${entries.length} entrées de temps sur ${config.temps.lookbackDays} jours`
      )
      return buildPointage(entries, config.temps, config.timezone, now)
    } catch (error) {
      logger.warn(`Temps pointés indisponibles : ${describe(error)}`)
      return null
    }
  }

  async #loadBranches(
    config: ClickUpDailyConfig,
    tasks: TaskView[],
    logger: BuildLogger,
    skip?: boolean
  ): Promise<Record<string, GitBranch[]>> {
    if (skip || !config.git.enabled) return {}

    const index = await this.git.loadBranchIndex(config.git, config.timezone, logger)
    const byTask: Record<string, GitBranch[]> = {}

    for (const task of tasks) {
      const found = branchesForTask(task.ref, index, config.git.maxBranchesPerTask)
      if (found.length) byTask[task.id] = found
    }

    return byTask
  }

  /**
   * La veille ne fait jamais échouer un rapport : sans réseau, elle rend
   * simplement null, et le tableau de bord se passe de son onglet.
   */
  async #loadVeille(
    config: ClickUpDailyConfig,
    now: DateTime,
    since: DateTime | null,
    logger: BuildLogger,
    skip?: boolean
  ) {
    if (skip || !config.veille.enabled) return null

    try {
      return await this.veille.collect({
        config: config.veille,
        zone: config.timezone,
        now,
        since,
        logger,
      })
    } catch (error) {
      logger.warn(`Veille indisponible : ${describe(error)}`)
      return null
    }
  }

  /**
   * Le coût des conversations ne fait jamais échouer un rapport non plus.
   *
   * En conteneur sans montage de ~/.claude, ou sur une machine où Claude Code
   * n'a jamais tourné, il n'y a simplement rien à lire : la carte disparaît.
   */
  async #loadClaude(
    config: ClickUpDailyConfig,
    now: DateTime,
    tasks: TaskView[],
    logger: BuildLogger,
    skip?: boolean
  ) {
    if (skip) return null

    try {
      return await this.claude.collect({
        config: config.claude,
        zone: config.timezone,
        now,
        logger,
        /* Les préfixes du workspace : ce qui distingue ROCND-699 de « GPT-4 ». */
        knownPrefixes: [...new Set(tasks.map((task) => task.ref.toLowerCase().split('-')[0]))],
      })
    } catch (error) {
      logger.warn(`Coût Claude indisponible : ${describe(error)}`)
      return null
    }
  }

  /**
   * Un seul balayage de commentaires sert deux usages : les afficher sous les
   * cartes concernées, et y chercher ce qui me cite. Les tâches déjà lues pour
   * l'affichage ne sont pas relues pour les mentions.
   *
   * Le cache passe avant l'API : une tâche dont la date de modification n'a
   * pas bougé depuis la dernière lecture n'a pas de nouveau commentaire. Ne
   * coûtent un appel que les tâches modifiées, plus un petit lot des entrées
   * les plus anciennes, pour rattraper ce que la date ne voit pas.
   */
  async #loadComments(options: {
    client: ClickUpClient
    config: ClickUpDailyConfig
    tasks: TaskView[]
    meUserId: number
    meName: string
    now: DateTime
    since: DateTime | null
    logger: BuildLogger
    skip: NonNullable<BuildReportOptions['skip']>
  }) {
    const { client, config, tasks, meUserId, meName, now, since, logger, skip } = options

    const forDisplay = skip.enrich ? [] : displayTargets(tasks, config.enrich)
    const fetched = new Set(forDisplay.map((task) => task.id))
    const forMentions = skip.mentions ? [] : mentionTargets(tasks, config.mentions, fetched)

    const wanted = [...forDisplay, ...forMentions]
    const raw: Record<string, RawComment[]> = {}

    if (wanted.length) {
      const stampOf = (task: TaskView) => String(task.updated?.toMillis() ?? '')
      const cached = await this.cache.comments(
        wanted.map((task) => ({ id: task.id, stamp: stampOf(task) }))
      )
      for (const [id, entry] of cached) raw[id] = entry.comments

      const horizon = now.minus({ hours: REVALIDATE_AFTER_HOURS })
      const missing = wanted.filter((task) => !cached.has(task.id))
      const stale = wanted
        .filter((task) => cached.has(task.id) && cached.get(task.id)!.fetchedAt < horizon)
        .sort(
          (a, b) => cached.get(a.id)!.fetchedAt.toMillis() - cached.get(b.id)!.fetchedAt.toMillis()
        )
        .slice(0, REVALIDATE_PER_RUN)

      const read: { id: string; stamp: string; comments: RawComment[] }[] = []
      await mapWithConcurrency([...missing, ...stale], 6, async (task) => {
        try {
          const comments = await client.comments(task.id)
          raw[task.id] = comments
          read.push({ id: task.id, stamp: stampOf(task), comments })
        } catch (error) {
          logger.warn(`Commentaires indisponibles pour ${task.ref} : ${describe(error)}`)
        }
      })
      await this.cache.rememberComments(read, now)

      logger.info(
        `Commentaires : ${forDisplay.length} tâches affichées + ${forMentions.length} balayées · ` +
          `${cached.size} en cache, ${missing.length} à lire, ${stale.length} à revérifier`
      )
    }

    const comments: Record<string, TaskComment[]> = {}
    for (const task of forDisplay) {
      const latest = [...(raw[task.id] ?? [])]
        .sort((a, b) => asInt(b.date) - asInt(a.date))
        .slice(0, config.enrich.commentsPerTask)

      if (latest.length) {
        comments[task.id] = latest.map((comment) => ({
          author: comment.user?.username ?? '?',
          at: msToDateTime(comment.date, config.timezone),
          /*
           * commentText() gère les deux formes de l'API : texte à plat ET
           * blocs. Le refaire à la main ici ne lisait que la première, donc un
           * commentaire portant une mention ou un lien s'affichait vide sous
           * la carte — alors que findMentions, trois lignes plus bas, le lisait
           * correctement.
           */
          text: commentText(comment),
        }))
      }
    }

    const mentions = skip.mentions
      ? []
      : findMentions({
          tasks,
          comments: raw,
          config: config.mentions,
          meUserId,
          meName,
          zone: config.timezone,
          now,
          since,
        })

    if (mentions.length) logger.info(`${mentions.length} commentaires me concernent`)
    return { comments, mentions }
  }

  /**
   * Statut actuel des tâches sorties du périmètre. C'est un appel par tâche
   * pour un simple agrément d'affichage : le cache répond d'abord, et les
   * lectures restantes — les inconnues, puis les plus anciennes — sont
   * plafonnées par run. Ce qui manque aujourd'hui sera lu au prochain.
   */
  async #exitStatuses(
    client: ClickUpClient,
    previous: { tasks: TaskSnapshot[] } | null,
    current: TaskView[],
    now: DateTime,
    logger: BuildLogger
  ): Promise<Record<string, string>> {
    if (!previous) return {}

    const present = new Set(current.map((task) => task.id))
    const left = previous.tasks.filter((task) => !present.has(task.id))
    if (left.length === 0) return {}

    const cached = await this.cache.exitStatuses(left.map((task) => task.id))
    const statuses: Record<string, string> = {}
    for (const [id, entry] of cached) statuses[id] = entry.status

    const horizon = now.minus({ hours: REVALIDATE_AFTER_HOURS })
    const ageOf = (id: string) => cached.get(id)?.fetchedAt.toMillis() ?? 0
    const toFetch = left
      .filter((task) => !cached.has(task.id) || cached.get(task.id)!.fetchedAt < horizon)
      .sort((a, b) => ageOf(a.id) - ageOf(b.id))
      .slice(0, EXIT_LOOKUPS_PER_RUN)

    const fetched: { id: string; status: string }[] = []
    await mapWithConcurrency(toFetch, 6, async (snapshot) => {
      try {
        const detail = await client.task(snapshot.id)
        const status = detail.status?.status
        if (!status) return
        statuses[snapshot.id] = status
        fetched.push({ id: snapshot.id, status })
      } catch (error) {
        if (error instanceof ClickUpError) {
          logger.debug(`Statut de sortie inconnu pour ${snapshot.ref} : ${error.message}`)
        }
      }
    })
    await this.cache.rememberExitStatuses(fetched, now)

    logger.info(
      `Sorties : ${left.length} tâches · ${cached.size} statuts en cache, ${toFetch.length} à lire`
    )
    return statuses
  }
}

/** L'instantané retenu pour la comparaison du lendemain. */
export function snapshotOf(report: Report): TaskSnapshot[] {
  return report.tasks.map(toSnapshot)
}

/**
 * Chronomètre une étape et la journalise. Une étape qui ne pèse rien ne
 * mérite qu'une ligne de debug : le journal doit montrer où va le temps,
 * pas le noyer.
 */
function stageTimer(logger: BuildLogger) {
  return async <T>(label: string, work: () => Promise<T>): Promise<T> => {
    const startedAt = Date.now()
    const result = await work()
    const seconds = (Date.now() - startedAt) / 1000
    const line = `${label} · ${seconds.toFixed(1)} s`
    if (seconds >= 0.5) logger.info(line)
    else logger.debug(line)
    return result
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
