import { createHash } from 'node:crypto'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import app from '@adonisjs/core/services/app'
import { mapWithConcurrency } from '#clickup/rate_limiter'
import { parseFeed } from '#domain/veille/feed'
import { buildVeille } from '#domain/veille/select'
import type { DateTime } from 'luxon'
import type { FetchedFeed } from '#domain/veille/select'
import type { Veille } from '#domain/veille/types'
import type { VeilleConfig, VeilleSource } from '#domain/config/types'

export interface VeilleServiceLogger {
  debug: (message: string) => void
  info: (message: string) => void
  warn: (message: string) => void
}

export interface CollectVeilleOptions {
  config: VeilleConfig
  zone: string
  now: DateTime
  since: DateTime | null
  logger: VeilleServiceLogger
}

/**
 * Téléchargement des flux, et rien d'autre.
 *
 * La sélection (fenêtre, quotas, dédoublonnage, mots-clés) vit dans
 * `app/domain/veille` et se teste sans réseau ; ici on ne fait que
 * rapporter du XML, avec un cache disque pour ne pas retélécharger vingt
 * flux à chaque « Rafraîchir ».
 *
 * Un flux qui ne répond pas ne fait jamais échouer la collecte : il ressort
 * en `reachable: false`, et le tableau de bord le dit.
 */
export class VeilleService {
  async collect(options: CollectVeilleOptions): Promise<Veille | null> {
    const { config, zone, now, since, logger } = options
    if (!config.enabled) return null

    const cache = app.tmpPath('veille')
    await mkdir(cache, { recursive: true })

    const feeds = await mapWithConcurrency(config.sources, 6, (source) =>
      this.#read(source, config, zone, cache, logger)
    )

    const veille = buildVeille({ feeds, config, now, since })
    const muets = veille.sources.filter((source) => !source.reachable)
    logger.info(
      `Veille : ${veille.articles.length} articles sur ${config.sources.length} sources` +
        (muets.length ? ` (${muets.length} injoignables)` : '')
    )

    return veille
  }

  /** Le flux, depuis le cache s'il est encore frais, depuis le réseau sinon. */
  async #read(
    source: VeilleSource,
    config: VeilleConfig,
    zone: string,
    cache: string,
    logger: VeilleServiceLogger
  ): Promise<FetchedFeed> {
    const identity = { label: source.label, group: source.group }
    const path = join(cache, `${createHash('sha1').update(source.url).digest('hex')}.xml`)

    const cached = await this.#fresh(path, config.cacheHours)
    if (cached !== null) {
      logger.debug(`Veille : ${source.label} servi depuis le cache`)
      return { source: identity, items: parseFeed(cached, zone) }
    }

    try {
      const response = await fetch(source.url, {
        headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9' },
        signal: AbortSignal.timeout(config.timeoutSeconds * 1000),
        redirect: 'follow',
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const xml = await response.text()
      await writeFile(path, xml, 'utf8').catch(() => {
        /* Un cache qui ne s'écrit pas ne justifie pas de perdre le flux. */
      })

      return { source: identity, items: parseFeed(xml, zone) }
    } catch (error) {
      logger.warn(`Veille : ${source.label} injoignable (${describe(error)})`)

      /* Périmé vaut mieux que rien : on retombe sur le cache à n'importe quel âge. */
      const stale = await readFile(path, 'utf8').catch(() => null)
      return { source: identity, items: stale === null ? null : parseFeed(stale, zone) }
    }
  }

  /** Le contenu du cache s'il a moins de `hours` heures, `null` sinon. */
  async #fresh(path: string, hours: number): Promise<string | null> {
    try {
      const info = await stat(path)
      if (Date.now() - info.mtimeMs > hours * 3_600_000) return null
      return await readFile(path, 'utf8')
    } catch {
      return null
    }
  }
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.name === 'TimeoutError' ? 'délai dépassé' : error.message
  return String(error)
}
