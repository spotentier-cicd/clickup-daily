/*
| Formats d'affichage. Le serveur envoie des dates ISO et des millisecondes ;
| tout le rendu lisible se fait ici, en un seul endroit.
*/

const DATE = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const DATE_TIME = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const LONG_DATE = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const WEEKDAY = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' })
const SHORT_DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
const TIME = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })

export function formatDate(iso: string | null): string {
  return iso ? DATE.format(new Date(iso)) : ''
}

export function formatDateTime(iso: string | null): string {
  return iso ? DATE_TIME.format(new Date(iso)) : ''
}

export function formatLongDate(iso: string): string {
  return LONG_DATE.format(new Date(iso))
}

export function formatWeekday(iso: string): string {
  return WEEKDAY.format(new Date(iso)).replace('.', '')
}

/** « 30 sept. » — pour une échéance, où l'année se devine. */
export function formatShortDate(iso: string | null): string {
  return iso ? SHORT_DATE.format(new Date(iso)) : ''
}

export function formatTime(iso: string): string {
  return TIME.format(new Date(iso))
}

/**
 * Jours pleins écoulés entre deux instants ISO.
 *
 * La référence est la date de génération du rapport, jamais l'horloge du
 * navigateur : une archive ouverte trois semaines plus tard doit continuer de
 * dire « il y a 2 j », sinon elle se raconte l'histoire d'aujourd'hui.
 */
export function daysSince(iso: string | null, reference: string): number | null {
  if (!iso) return null
  const elapsed = new Date(reference).getTime() - new Date(iso).getTime()
  return Math.max(0, Math.floor(elapsed / 86_400_000))
}

/** « 4h30 », « 2h », « 45min » — vide en dessous de la minute. */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000)
  if (totalMinutes <= 0) return ''

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours && minutes) return `${hours}h${String(minutes).padStart(2, '0')}`
  if (hours) return `${hours}h`
  return `${minutes}min`
}

/*
| DEUX UNITÉS, ET LA RÈGLE QUI LES SÉPARE :
| une quantité hebdomadaire se COMPARE (13,2 h / 28 h, −7,8 h),
| la durée d'une tâche se LIT (4h30).
| D'où formatHours pour les agrégats du pointage, formatDuration pour une tâche.
*/

/** « 13,2 h » — réservé aux agrégats hebdomadaires. */
export function formatHours(ms: number): string {
  return `${(ms / 3_600_000).toFixed(1).replace('.', ',')} h`
}

/** « −7,8 h » avec un vrai signe moins U+2212, qui s'aligne sur des chiffres tabulaires. */
export function formatSignedHours(ms: number): string {
  const sign = ms < 0 ? '\u2212' : ms > 0 ? '+' : ''
  return `${sign}${formatHours(Math.abs(ms))}`
}

/** Jours-homme, sur la base d'une journée pleine. */
export function formatWorkDays(ms: number, targetMs: number): string {
  if (!targetMs) return ''
  const days = ms / targetMs
  return `${days.toFixed(days >= 10 ? 0 : 1).replace('.', ',')} j`
}

export function formatAge(days: number | null): string {
  if (days === null) return ''
  if (days === 0) return "aujourd'hui"
  if (days === 1) return 'hier'
  return `il y a ${days} j`
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count > 1 ? plural : singular}`
}
