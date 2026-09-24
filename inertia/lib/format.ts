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

export const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'Urgent',
  high: 'Haute',
  normal: 'Normale',
  low: 'Basse',
}

/**
 * Un point de 5 px, et RIEN pour normal et basse.
 *
 * La majorité des tâches sont en priorité normale : les colorier reviendrait à
 * ne rien dire tout en occupant l'œil. Le libellé complet reste disponible en
 * infobulle.
 */
export const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-urgent',
  high: 'bg-attention',
}

/**
 * Le ton d'un blocage, branché sur la table SEVERITY du domaine.
 *
 * 0 commentaire assigné · 1 échéance dépassée · 2 je bloque quelqu'un → urgent
 * 3 travail non poussé · 4 ma revue attend                            → attention
 * 5 sans activité · 6 dort sur recette                                → neutre
 *
 * Ça traîne n'est pas ça brûle : les deux derniers ne prennent pas de couleur.
 */
export function severityTone(severity: number): 'urgent' | 'attention' | 'muted' {
  if (severity <= 2) return 'urgent'
  if (severity <= 4) return 'attention'
  return 'muted'
}

export const TONE_TEXT = {
  urgent: 'text-urgent',
  attention: 'text-attention',
  muted: 'text-muted-foreground',
} as const

export const TONE_RAIL = {
  urgent: 'before:bg-urgent',
  attention: 'before:bg-attention',
  muted: '',
} as const
