import { type DateTime } from 'luxon'
import { isBug } from '#domain/rules/bugs'
import { columnFor } from '#domain/task/columns'
import { customFieldValue } from '#domain/task/custom_fields'
import { asInt, daysAgo, formatDurationMs, msToDateTime } from '#domain/time'
import type { Column, ColumnMapping, CustomFieldValue, RawTask, TaskView } from '#domain/task/types'
import type { ClickUpDailyConfig } from '#domain/config/types'

export interface ToTaskViewOptions {
  raw: RawTask
  /** L'espace ClickUp d'où vient la tâche : son identifiant et son nom. */
  space: { key: string; label: string }
  columns: Column[]
  /** Rattachement statut → colonne choisi dans /parametres. */
  mapping?: ColumnMapping
  config: ClickUpDailyConfig
  meUserId: number
  now: DateTime
  /** Libellés des types de tâche ClickUp, par custom_item_id. */
  taskTypeNames?: Map<number, string>
}

/**
 * Normalise une tâche brute de l'API.
 *
 * Ne renvoie jamais null : depuis que les statuts se choisissent liste par
 * liste, un statut que le workflow ne connaît pas n'est plus une anomalie à
 * écarter mais un choix assumé — il atterrit dans la colonne « Autres ».
 */
export function toTaskView(options: ToTaskViewOptions): TaskView {
  const { raw, space, columns, mapping, config, meUserId, now, taskTypeNames } = options
  const zone = config.timezone

  const status = raw.status?.status ?? ''
  const column = columnFor(status, columns, mapping)

  const assignees = raw.assignees ?? []
  const assigneeIds = assignees
    .filter((a) => a.id !== null && a.id !== undefined)
    .map((a) => asInt(a.id))
    .filter((id) => id !== 0)

  const customFields: CustomFieldValue[] = []
  for (const field of raw.custom_fields ?? []) {
    const name = field.name ?? ''
    if (config.ignoredCustomFieldsPrefix.some((prefix) => name.startsWith(prefix))) continue

    const value = customFieldValue(field, zone)
    if (value) customFields.push({ name, value })
  }

  const due = msToDateTime(raw.due_date, zone)
  const updated = msToDateTime(raw.date_updated, zone)
  const isOverdue = Boolean(due && due.startOf('day') < now.startOf('day'))

  const task: TaskView = {
    id: String(raw.id ?? ''),
    ref: String(raw.custom_id || raw.id || ''),
    name: (raw.name ?? '').trim() || '(sans titre)',
    url: raw.url || `https://app.clickup.com/t/${raw.id}`,
    envKey: space.key,
    envLabel: space.label || space.key,
    status,
    column: column.key,
    columnLabel: column.label,
    columnOrder: column.order,
    priority: raw.priority?.priority ?? null,
    assignees: assignees.map((a) => String(a.username || a.email || a.id)),
    assigneeIds,
    isMine: assigneeIds.includes(meUserId),
    tags: (raw.tags ?? []).map((t) => t.name ?? '').filter(Boolean),
    listId: String(raw.list?.id ?? ''),
    listName: raw.list?.name ?? '',
    folderId: String(raw.folder?.id ?? ''),
    folderName: raw.folder?.name ?? '',
    parent: raw.parent ?? null,
    due,
    updated,
    created: msToDateTime(raw.date_created, zone),
    timeEstimate: formatDurationMs(raw.time_estimate),
    timeEstimateMs: asInt(raw.time_estimate),
    timeSpentMs: asInt(raw.time_spent),
    myTimeMs: 0,
    customFields,
    description: (raw.text_content ?? raw.description ?? '').trim(),
    taskType: typeLabel(raw.custom_item_id, taskTypeNames),
    isBug: false,
    staleDays: daysAgo(updated, now),
    isOverdue,
    overdueDays: isOverdue && due ? (daysAgo(due, now) ?? 0) : 0,
  }

  task.isBug = isBug(task, config.bugs)
  return task
}

/**
 * Le libellé du type ClickUp.
 *
 * custom_item_id est absent ou nul pour une tâche ordinaire ; seuls les autres
 * types — User Story, EPIC, Bug… — portent un nom dans le workspace.
 */
function typeLabel(
  customItemId: number | string | null | undefined,
  names?: Map<number, string>
): string {
  if (customItemId === null || customItemId === undefined || customItemId === '') return 'Tâche'

  const id = asInt(customItemId)
  if (id === 0) return 'Tâche'

  return names?.get(id) || `Type ${id}`
}
