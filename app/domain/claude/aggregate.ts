import { addUsage, costOf, emptyUsage, isBillable, normalizeModel } from '#domain/claude/pricing'
import type { DateTime } from 'luxon'
import type { TokenUsage } from '#domain/claude/pricing'
import type { ClaudeUsage } from '#domain/claude/types'

/*
| L'AGRÉGATION.
|
| Le service lit les fichiers et en sort des relevés ; tout le calcul se fait
| ici, sur des données déjà en mémoire. C'est ce qui rend la tarification
| testable sans transcription sur le disque.
*/

/** Une réponse du modèle, dépouillée de tout ce qui ne sert pas au calcul. */
export type ClaudeEntry = {
  at: DateTime
  model: string
  /** « fast » quand le mode rapide était actif ; change les tarifs. */
  speed?: string
  usage: TokenUsage
  /** Références de tickets rattachées, en minuscules. */
  refs: string[]
  sessionId: string
}

export type AggregateOptions = {
  /** Début de période, inclus. */
  since: DateTime
  /** Fin de période, exclue. */
  until: DateTime
  now: DateTime
}

/** Les centièmes de cent ne veulent rien dire, et alourdissent le JSON stocké. */
function round(usd: number): number {
  return Math.round(usd * 1e6) / 1e6
}

export function buildClaudeUsage(entries: ClaudeEntry[], options: AggregateOptions): ClaudeUsage {
  const { since, until, now } = options
  const today = now.toISODate()

  const byModel = new Map<string, { usd: number; tokens: TokenUsage }>()
  const byDay = new Map<string, number>()
  const byRef = new Map<string, number>()
  const sessions = new Set<string>()
  const unknown = new Set<string>()

  let totalUsd = 0
  let attributedUsd = 0

  for (const entry of entries) {
    if (entry.at < since || entry.at >= until) continue
    if (!isBillable(entry.model)) continue

    const usd = costOf(entry.usage, entry.model, entry.speed)
    if (usd === null) {
      /* Modèle inconnu : signalé, jamais compté comme un zéro. */
      unknown.add(entry.model)
      continue
    }

    sessions.add(entry.sessionId)
    totalUsd += usd

    const model = normalizeModel(entry.model)
    const previous = byModel.get(model) ?? { usd: 0, tokens: emptyUsage() }
    byModel.set(model, {
      usd: previous.usd + usd,
      tokens: addUsage(previous.tokens, entry.usage),
    })

    const day = entry.at.toISODate()
    if (day) byDay.set(day, (byDay.get(day) ?? 0) + usd)

    if (entry.refs.length === 0) continue

    /*
     * Une conversation qui cite trois tickets a servi aux trois : on partage
     * plutôt que d'attribuer le plein montant à chacun, ce qui gonflerait la
     * somme des tickets bien au-delà du total réel.
     */
    attributedUsd += usd
    const share = usd / entry.refs.length
    for (const ref of entry.refs) {
      byRef.set(ref, (byRef.get(ref) ?? 0) + share)
    }
  }

  return {
    since,
    until,
    totalUsd: round(totalUsd),
    todayUsd: round(today ? (byDay.get(today) ?? 0) : 0),
    byModel: [...byModel.entries()]
      .map(([model, entry]) => ({ model, usd: round(entry.usd), tokens: entry.tokens }))
      .sort((a, b) => b.usd - a.usd),
    byDay: [...byDay.entries()]
      .map(([day, usd]) => ({ day, usd: round(usd) }))
      .sort((a, b) => a.day.localeCompare(b.day)),
    byRef: Object.fromEntries(
      [...byRef.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([ref, usd]) => [ref, round(usd)] as const)
    ),
    unattributedUsd: round(totalUsd - attributedUsd),
    sessions: sessions.size,
    unknownModels: [...unknown].sort(),
  }
}
