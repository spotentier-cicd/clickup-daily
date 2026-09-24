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

export const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'Urgent',
  high: 'Haute',
  normal: 'Normale',
  low: 'Basse',
}

/** Une couleur par priorité, assez sobre pour ne pas noyer le reste. */
export const PRIORITY_CLASS: Record<string, string> = {
  urgent: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
  high: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30',
  normal: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
  low: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30',
}
