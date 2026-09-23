import { normalize } from '#domain/text'
import type { TaskView } from '#domain/task/types'
import type { BugsConfig } from '#domain/config/types'

/**
 * Une tâche est un bug si l'une de ces règles suffit : type de tâche ClickUp
 * « Bug », liste dont le nom contient « bug », tag « bug », ou titre commençant
 * par « bug ». Les règles sont dans config → bugs.
 */
export function isBug(
  task: Pick<TaskView, 'taskType' | 'listName' | 'tags' | 'name'>,
  config: BugsConfig
): boolean {
  const taskType = normalize(task.taskType)
  if (taskType && config.taskTypes.map(normalize).includes(taskType)) return true

  const listName = normalize(task.listName)
  if (
    config.listNameContains.some(
      (fragment) => normalize(fragment) && listName.includes(normalize(fragment))
    )
  ) {
    return true
  }

  const tags = new Set(task.tags.map(normalize))
  if (config.tags.some((tag) => tags.has(normalize(tag)))) return true

  const name = normalize(task.name)
  return config.namePrefixes.some(
    (prefix) => normalize(prefix) && name.startsWith(normalize(prefix))
  )
}
