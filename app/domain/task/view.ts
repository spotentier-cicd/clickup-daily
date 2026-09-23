import { type DateTime } from 'luxon'
import { isBug } from '#domain/rules/bugs'
import { columnFor } from '#domain/task/columns'
import { customFieldValue } from '#domain/task/custom_fields'
import { asInt, daysAgo, formatDurationMs, msToDateTime } from '#domain/time'
import type { Column, CustomFieldValue, RawTask, TaskView } from '#domain/task/types'
import type { ClickUpDailyConfig, EnvironmentConfig } from '#domain/config/types'

export interface ToTaskViewOptions {
  raw: RawTask
  environment: EnvironmentConfig
  columns: Column[]
  config: ClickUpDailyConfig
  meUserId: number
  now: DateTime
  /** Libellés des types de tâche ClickUp, par custom_item_id. */
  taskTypeNames?: Map<number, string>
}

/**
 * Normalise une tâche brute de l'API.
 *
 * Renvoie null quand le statut n'appartient à aucune colonne : la tâche est
 * alors hors périmètre et n'entre pas dans le rapport.
 */
export function toTaskView(options: ToTaskViewOptions): TaskView | null {
  const { raw, environment, columns, config, meUserId, now, taskTypeNames } = options
  const zone = config.timezone

  const status = raw.status?.status ?? ''
  const column = columnFor(status, columns)
  if (!column) return null

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
    envKey: environment.key,
    envLabel: environment.label || environment.key,
    status,
    column: column.key,
    columnLabel: column.label,
    columnOrder: column.order,
    priority: raw.priority?.priority ?? null,
    assignees: assignees.map((a) => String(a.username || a.email || a.id)),
    assigneeIds,
    isMine: assigneeIds.includes(meUserId),
    tags: (raw.tags ?? []).map((t) => t.name ?? '').filter(Boolean),
    listName: raw.list?.name ?? '',
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
    taskType: resolveTaskType(raw.custom_item_id, taskTypeNames),
    isBug: false,
    staleDays: daysAgo(updated, now),
    isOverdue,
    overdueDays: isOverdue && due ? (daysAgo(due, now) ?? 0) : 0,
  }

  task.isBug = isBug(task, config.bugs)
  return task
}

/**
 * custom_item_id vaut 0 (ou rien) pour une tâche ordinaire ; seuls les autres
 * types — User Story, EPIC, Bug, Feature — portent un libellé.
 */
function resolveTaskType(
  customItemId: number | string | null | undefined,
  taskTypeNames?: Map<number, string>
): string {
  if (customItemId === null || customItemId === undefined) return ''
  if (customItemId === 0 || customItemId === '0') return ''

  const id = asInt(customItemId)
  return taskTypeNames?.get(id) ?? ''
}
