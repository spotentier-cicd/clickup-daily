import { DateTime } from 'luxon'

/*
| Dates, durées et formats. Purs : toute fonction qui a besoin de « maintenant »
| le reçoit en paramètre, jamais via DateTime.now(). C'est ce qui rend les
| règles (retard, ancienneté, semaine de pointage) testables sans geler l'horloge.
*/

/**
 * Entier tolérant : l'API rend les durées et les identifiants tantôt en
 * nombre, tantôt en chaîne.
 */
export function asInt(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0
}

/** Horodatage ClickUp (millisecondes) vers DateTime dans le fuseau donné. */
export function msToDateTime(ms: unknown, zone: string): DateTime | null {
  if (ms === null || ms === undefined || ms === '' || ms === 0 || ms === '0') return null
  const value = asInt(ms)
  if (!value) return null
  const dt = DateTime.fromMillis(value, { zone })
  return dt.isValid ? dt : null
}

/** Nombre de jours calendaires écoulés, jamais négatif. */
export function daysAgo(dt: DateTime | null, now: DateTime): number | null {
  if (!dt) return null
  const days = now.startOf('day').diff(dt.startOf('day'), 'days').days
  return Math.max(0, Math.round(days))
}

export function formatDate(dt: DateTime | null): string {
  return dt ? dt.toFormat('dd/MM/yyyy') : ''
}

export function formatDateTime(dt: DateTime | null): string {
  return dt ? dt.toFormat('dd/MM/yyyy HH:mm') : ''
}

/** « mardi 23 septembre 2026 » */
export function formatLongDate(dt: DateTime): string {
  return dt.setLocale('fr').toFormat('cccc d LLLL yyyy')
}

export function formatAge(days: number | null): string {
  if (days === null) return ''
  if (days === 0) return "aujourd'hui"
  if (days === 1) return 'hier'
  return `il y a ${days} j`
}

/** « 4h30 », « 2h », « 45min » — chaîne vide en dessous de la minute. */
export function formatDurationMs(ms: unknown): string {
  const totalMinutes = Math.floor(asInt(ms) / 60000)
  if (totalMinutes <= 0) return ''

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours && minutes) return `${hours}h${String(minutes).padStart(2, '0')}`
  if (hours) return `${hours}h`
  return `${minutes}min`
}

/** Tronque sur un mot entier et suffixe d'une ellipse. */
export function excerpt(text: string | null | undefined, limit: number): string {
  if (!text) return ''

  const collapsed = text.split(/\s+/).filter(Boolean).join(' ')
  if (collapsed.length <= limit) return collapsed

  const cut = collapsed.slice(0, limit)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + '…'
}
