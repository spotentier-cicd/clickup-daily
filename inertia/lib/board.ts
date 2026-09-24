import { branchState } from '#domain/git/types'
import { rankFields } from '@/lib/filters'
import { daysSince, formatAge, formatDuration, formatShortDate } from '@/lib/format'
import type { FieldUsage, ProjectPreferences } from '@/lib/projects'
import type { Branch, Comment, Report, ReportColumn, Task } from '@/lib/report'

/*
| L'HABILLAGE D'UNE TÂCHE.
|
| Tout ce que le rendu doit savoir dire d'une carte — ses étiquettes, sa
| couleur de liseré, ses phrases de temps et d'échéance — est calculé ici, une
| fois, et pas dans six composants. Les règles métier restent dans app/domain :
| ce module ne fait que de la mise en mots.
*/

export type Label = { text: string; fg: string; bg: string }

export type BranchLine = {
  repo: string
  name: string
  /** Du travail qui n'existe que sur ce poste : ça se dit en ambre. */
  warn: boolean
  note: string
}

export interface DressedTask {
  task: Task
  mine: boolean
  labels: Label[]
  /** Liseré gauche : la priorité, et rien d'autre. */
  prioColor: string
  envColor: string
  assignees: string
  due: { text: string; short: string; late: boolean } | null
  time: { text: string; short: string; over: boolean } | null
  updated: string
  fields: Task['customFields']
  branches: BranchLine[]
  comments: Comment[]
  /** Équivalent API des conversations Claude rattachées à ce ticket ce mois-ci. */
  claudeUsd: number
  /** Vrai dès qu'il reste quelque chose à montrer sous la carte. */
  hasDetail: boolean
}

/**
 * Cinq teintes distribuées aux espaces dans l'ordre du rapport.
 *
 * Les espaces ClickUp n'ont pas de couleur en configuration ; l'index suffit à
 * rendre la même couleur au même espace tant que la configuration ne change
 * pas d'ordre, et un sixième espace reprend simplement la première teinte.
 */
export function environmentColors(environments: { key: string }[]): Map<string, string> {
  return new Map(
    environments.map((environment, index) => [environment.key, `var(--env-${(index % 5) + 1})`])
  )
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'var(--red)',
  high: 'var(--amber)',
}

const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'Urgente',
  high: 'Haute',
}

/** Une couleur diluée, pour un fond d'étiquette qui laisse lire son texte. */
export function tint(color: string, percent = 16): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`
}

export interface DressOptions {
  report: Report
  fields: FieldUsage[]
  preferences: ProjectPreferences
  envColors: Map<string, string>
}

export function dressTask(task: Task, options: DressOptions): DressedTask {
  const { report, fields, preferences, envColors } = options
  const envColor = envColors.get(task.envKey) ?? 'var(--env-1)'

  const labels: Label[] = [{ text: task.envLabel, fg: envColor, bg: tint(envColor, 14) }]
  if (task.isBug) labels.push({ text: 'Bug', fg: 'var(--red)', bg: tint('var(--red)') })
  else if (task.taskType)
    labels.push({ text: task.taskType, fg: 'var(--muted)', bg: 'var(--soft)' })

  const priority = task.priority ?? ''
  if (PRIORITY_LABEL[priority]) {
    const color = PRIORITY_COLOR[priority]
    labels.push({ text: PRIORITY_LABEL[priority], fg: color, bg: tint(color, 18) })
  }
  if (task.isMine) labels.push({ text: 'moi', fg: 'var(--tint-ink)', bg: 'var(--tint)' })

  const branches = (report.branches[task.id] ?? []).map((branch) =>
    line(branch, report.generatedAt)
  )
  const visibleFields = rankFields(task, fields, preferences, 4)
  const comments = report.comments[task.id] ?? []
  /* Le rattachement se fait par référence — c'est ce qu'on sait lire d'une branche. */
  const claudeUsd = report.claude?.byRef[task.ref.toLowerCase()] ?? 0

  return {
    task,
    mine: task.isMine,
    labels,
    prioColor: PRIORITY_COLOR[priority] ?? 'var(--prio-n)',
    envColor,
    assignees: task.assignees.length ? task.assignees.join(', ') : 'non assignée',
    due: dueOf(task),
    time: timeOf(task),
    updated: `maj ${formatAge(task.staleDays)}`,
    fields: visibleFields,
    branches,
    comments,
    claudeUsd,
    hasDetail:
      visibleFields.length > 0 ||
      task.tags.length > 0 ||
      branches.length > 0 ||
      comments.length > 0 ||
      task.description.length > 0,
  }
}

/** L'échéance, dite du point de vue d'aujourd'hui plutôt qu'en date brute. */
function dueOf(task: Task): DressedTask['due'] {
  if (!task.due) return null

  if (task.isOverdue) {
    const text = task.overdueDays === 0 ? "pour aujourd'hui" : `en retard de ${task.overdueDays} j`
    return { text, short: text.replace('en retard de ', 'retard '), late: true }
  }

  const short = formatShortDate(task.due)
  return { text: `pour le ${short}`, short, late: false }
}

/**
 * Le temps, en deux longueurs.
 *
 * `text` porte la phrase complète (pointé, ma part, estimation) ; `short` le
 * rapport qui tient dans une colonne de liste. Ma part n'est rappelée que
 * quand elle diffère du total de l'équipe : sinon c'est du bruit.
 */
function timeOf(task: Task): DressedTask['time'] {
  const spent = task.timeSpentMs
  const estimate = task.timeEstimateMs
  if (!spent && !estimate) return null

  const mine = task.isMine && task.myTimeMs > 0 && task.myTimeMs !== spent

  return {
    text:
      (spent ? `pointé ${formatDuration(spent)}` : 'rien de pointé') +
      (mine ? ` (moi ${formatDuration(task.myTimeMs)})` : '') +
      (estimate ? ` / estim. ${formatDuration(estimate)}` : ''),
    short: estimate
      ? `${spent ? formatDuration(spent) : '0h'} / ${formatDuration(estimate)}`
      : formatDuration(spent),
    over: estimate > 0 && spent > estimate,
  }
}

function line(branch: Branch, generatedAt: string): BranchLine {
  const state = branchState(branch)
  const age = formatAge(daysSince(branch.lastCommit, generatedAt))

  return {
    repo: branch.repo,
    name: branch.name,
    warn: state.length > 0,
    note: [state, age].filter(Boolean).join(' · '),
  }
}

/** Les colonnes qui portent au moins une tâche, dans l'ordre du workflow. */
export function columnsOf(
  columns: ReportColumn[],
  tasks: Task[]
): { column: ReportColumn; tasks: Task[] }[] {
  return columns
    .map((column) => ({ column, tasks: tasks.filter((task) => task.column === column.key) }))
    .filter((group) => group.tasks.length > 0)
}
