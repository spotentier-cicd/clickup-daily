import type { DateTime } from 'luxon'

/*
| Le brut venu de ClickUp, puis la vue normalisée dont tout le reste dépend.
|
| Ces types décrivent uniquement ce que le programme lit réellement dans la
| réponse de l'API : inutile de modéliser le reste, il changerait sans qu'on
| s'en aperçoive.
*/

export interface RawUser {
  id?: number | string
  username?: string
  email?: string
}

export interface RawCustomField {
  name?: string
  type?: string
  value?: unknown
  type_config?: {
    options?: { id?: string; name?: string; label?: string; orderindex?: number }[]
  }
}

export interface RawTask {
  id?: string | number
  custom_id?: string | null
  name?: string
  url?: string
  status?: { status?: string }
  priority?: { priority?: string } | null
  assignees?: RawUser[]
  tags?: { name?: string }[]
  list?: { name?: string }
  folder?: { name?: string }
  parent?: string | null
  due_date?: string | number | null
  date_updated?: string | number | null
  date_created?: string | number | null
  time_estimate?: string | number | null
  time_spent?: string | number | null
  text_content?: string | null
  description?: string | null
  custom_fields?: RawCustomField[]
  custom_item_id?: number | string | null
}

/** Une colonne du tableau, avec ses statuts déjà normalisés. */
export interface Column {
  key: string
  label: string
  /** Statuts normalisés (minuscules, sans accents). */
  match: string[]
  color: string
  order: number
}

export interface CustomFieldValue {
  name: string
  value: string
}

/** La tâche telle que le reste du programme la manipule. */
export interface TaskView {
  id: string
  /** Référence lisible (ROC-1789) ; retombe sur l'id si la tâche n'en a pas. */
  ref: string
  name: string
  url: string
  envKey: string
  envLabel: string
  status: string
  column: string
  columnLabel: string
  columnOrder: number
  priority: string | null
  assignees: string[]
  assigneeIds: number[]
  isMine: boolean
  tags: string[]
  listName: string
  folderName: string
  parent: string | null
  due: DateTime | null
  updated: DateTime | null
  created: DateTime | null
  /** Estimation formatée (« 4h30 ») ; la valeur brute est dans timeEstimateMs. */
  timeEstimate: string
  timeEstimateMs: number
  /** Temps pointé par toute l'équipe, sur toute l'histoire de la tâche. */
  timeSpentMs: number
  /** Ma part, reconstituée depuis mes entrées de temps sur temps.lookbackDays. */
  myTimeMs: number
  customFields: CustomFieldValue[]
  description: string
  taskType: string
  isBug: boolean
  /** Jours depuis la dernière modification. */
  staleDays: number | null
  isOverdue: boolean
  overdueDays: number
}

export const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
}

export const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'Urgent',
  high: 'Haute',
  normal: 'Normale',
  low: 'Basse',
}

/** Une estimation dépassée par le temps réellement pointé. */
export function isOverEstimate(task: TaskView): boolean {
  return task.timeEstimateMs > 0 && task.timeSpentMs > task.timeEstimateMs
}

/**
 * Tri d'affichage : priorité, puis échéance la plus proche, puis modifiée en
 * dernier. Les tâches sans priorité ou sans échéance passent après.
 */
export function compareTasks(a: TaskView, b: TaskView): number {
  const priority = (t: TaskView) => (t.priority ? (PRIORITY_ORDER[t.priority] ?? 4) : 4)
  if (priority(a) !== priority(b)) return priority(a) - priority(b)

  const due = (t: TaskView) => t.due?.toMillis() ?? Number.POSITIVE_INFINITY
  if (due(a) !== due(b)) return due(a) - due(b)

  return (b.updated?.toMillis() ?? 0) - (a.updated?.toMillis() ?? 0)
}
