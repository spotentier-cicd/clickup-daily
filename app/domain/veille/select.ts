import { findHighlights, normalize } from '#domain/text'
import type { DateTime } from 'luxon'
import type { FeedItem } from '#domain/veille/feed'
import type { Veille, VeilleArticle, VeilleSourceStatus } from '#domain/veille/types'
import type { VeilleConfig } from '#domain/config/types'

/*
| Ce qu'on garde des flux.
|
| Trois coupes successives, dans cet ordre : les préversions (une release
| candidate n'est pas une nouvelle), la fenêtre de dix jours, puis un quota
| par source — sans quoi un flux bavard comme Hacker News occuperait à lui
| seul la moitié de la page.
|
| Le dédoublonnage se fait sur l'URL : Laravel News et le blog Laravel
| relaient régulièrement la même annonce.
*/

/** Le résultat d'un flux. `items` à `null` veut dire injoignable. */
export type FetchedFeed = {
  source: { label: string; group: string }
  items: FeedItem[] | null
}

export interface BuildVeilleOptions {
  feeds: FetchedFeed[]
  config: VeilleConfig
  now: DateTime
  /** Date du rapport de référence : ce qui est paru depuis est « nouveau ». */
  since: DateTime | null
}

export function buildVeille(options: BuildVeilleOptions): Veille {
  const { feeds, config, now, since } = options

  const floor = now.minus({ days: config.maxAgeDays })
  const exclusions = config.excludeTitle.map(normalize).filter(Boolean)
  const sources: VeilleSourceStatus[] = []
  const retenus: VeilleArticle[] = []
  const vus = new Set<string>()

  for (const feed of feeds) {
    if (!feed.items) {
      sources.push({ ...feed.source, reachable: false, kept: 0 })
      continue
    }

    const candidats = feed.items
      .filter((item) => item.publishedAt !== null && item.publishedAt >= floor)
      .filter((item) => !isPrerelease(item.title, exclusions))
      .sort((a, b) => millis(b) - millis(a))

    let gardes = 0
    for (const item of candidats) {
      if (gardes >= config.perSource) break

      const id = canonical(item.url)
      if (vus.has(id)) continue
      vus.add(id)
      gardes++

      retenus.push({
        id,
        title: item.title,
        url: item.url,
        source: feed.source.label,
        group: feed.source.group,
        publishedAt: item.publishedAt,
        summary: item.summary,
        /*
         * Le libellé de la source fait partie de la botte de foin : le flux
         * des versions de Claude Code parle de Claude Code, même quand
         * l'entrée s'appelle « v2.4.0 ».
         */
        highlights: findHighlights(
          `${feed.source.label} ${item.title} ${item.summary}`,
          config.highlight
        ),
        isNew: since !== null && item.publishedAt !== null && item.publishedAt > since,
      })
    }

    sources.push({ ...feed.source, reachable: true, kept: gardes })
  }

  return {
    groups: config.groups.map((group) => ({ key: group.key, label: group.label })),
    articles: retenus.sort((a, b) => stamp(b) - stamp(a)).slice(0, config.maxItems),
    sources,
    lookbackDays: config.maxAgeDays,
  }
}

/**
 * Une préversion n'est pas une nouvelle.
 *
 * La comparaison passe par `normalize` des deux côtés : les libellés de
 * versions mélangent les casses (« RC », « -rc.1 ») et la configuration est
 * écrite en minuscules.
 */
function isPrerelease(title: string, exclusions: string[]): boolean {
  const needle = normalize(title)
  return exclusions.some((motif) => needle.includes(motif))
}

/**
 * L'URL réduite à ce qui identifie la page.
 *
 * Les flux ajoutent des paramètres de campagne (`utm_source`) et un slash
 * final aléatoire : sans ça, la même annonce reviendrait deux fois.
 */
function canonical(url: string): string {
  return url
    .trim()
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')
    .toLowerCase()
}

function millis(item: FeedItem): number {
  return item.publishedAt?.toMillis() ?? 0
}

function stamp(article: VeilleArticle): number {
  return article.publishedAt?.toMillis() ?? 0
}
