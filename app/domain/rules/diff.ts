import { normalize } from '#domain/text'
import type { DateTime } from 'luxon'
import type { TaskView, TaskViewOf } from '#domain/task/types'

/*
| Ce qui a bougé depuis le rapport précédent.
|
| La v1 comparait deux fichiers JSON. Ici la référence est le run précédent en
| base : même calcul, mais on peut remonter plus loin qu'hier.
*/

/** L'état d'une tâche retenu pour la comparaison du lendemain. */
export type TaskSnapshot = {
  id: string
  ref: string
  name: string
  url: string
  envKey: string
  status: string
  column: string
  assigneeIds: number[]
}

export type ReportDiffOf<D> = {
  /** Date du run de référence, null au tout premier rapport. */
  since: D | null
  entered: TaskViewOf<D>[]
  statusChanged: { task: TaskViewOf<D>; previousStatus: string }[]
  /** Tâches sorties du périmètre, avec leur dernier statut connu. */
  left: { snapshot: TaskSnapshot; newStatus: string }[]
  assignedToMe: TaskViewOf<D>[]
}

export type ReportDiff = ReportDiffOf<DateTime>

export function toSnapshot(task: TaskView): TaskSnapshot {
  return {
    id: task.id,
    ref: task.ref,
    name: task.name,
    url: task.url,
    envKey: task.envKey,
    status: task.status,
    column: task.column,
    assigneeIds: task.assigneeIds,
  }
}

export interface ComputeDiffOptions {
  previous: { at: DateTime; tasks: TaskSnapshot[] } | null
  current: TaskView[]
  meUserId: number
  /**
   * Statut actuel des tâches sorties du périmètre, par identifiant. Le domaine
   * ne va pas le chercher : l'appelant l'a récupéré s'il le pouvait.
   */
  exitStatuses?: Record<string, string>
}

export function computeDiff(options: ComputeDiffOptions): ReportDiff {
  const { previous, current, meUserId, exitStatuses = {} } = options

  const diff: ReportDiff = {
    since: previous?.at ?? null,
    entered: [],
    statusChanged: [],
    left: [],
    assignedToMe: [],
  }

  /* Au premier rapport il n'y a rien à comparer : tout est « nouveau » et ne dit rien. */
  if (!previous) return diff

  const before = new Map(previous.tasks.map((task) => [task.id, task]))
  const after = new Map(current.map((task) => [task.id, task]))

  for (const task of current) {
    const old = before.get(task.id)

    if (!old) {
      diff.entered.push(task)
      continue
    }

    if (normalize(old.status) !== normalize(task.status)) {
      diff.statusChanged.push({ task, previousStatus: old.status })
    }

    if (task.assigneeIds.includes(meUserId) && !old.assigneeIds.includes(meUserId)) {
      diff.assignedToMe.push(task)
    }
  }

  for (const snapshot of previous.tasks) {
    if (after.has(snapshot.id)) continue
    diff.left.push({ snapshot, newStatus: exitStatuses[snapshot.id] ?? '?' })
  }

  return diff
}
