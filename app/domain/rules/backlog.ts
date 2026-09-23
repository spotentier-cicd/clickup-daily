import { normalize } from '#domain/text'
import type { TaskView } from '#domain/task/types'
import type { BacklogConfig } from '#domain/config/types'

/**
 * Une tâche encore « nouveau » au fond d'un dossier Backlog n'a pas été
 * priorisée : ce n'est pas du travail du jour, et elle noierait le tableau
 * (environ 87 tâches sur les trois espaces).
 *
 * Une tâche qui m'est assignée reste affichée, sauf si keepMine est mis à
 * false. Vider `statuses` désactive complètement le filtre.
 */
export function isBacklog(
  task: Pick<TaskView, 'status' | 'isMine' | 'folderName' | 'listName'>,
  config: BacklogConfig
): boolean {
  const statuses = config.statuses.map(normalize).filter(Boolean)
  if (statuses.length === 0 || !statuses.includes(normalize(task.status))) return false

  if (task.isMine && config.keepMine) return false

  const folder = normalize(task.folderName)
  const list = normalize(task.listName)
  return (
    config.folderNameContains.some((m) => normalize(m) && folder.includes(normalize(m))) ||
    config.listNameContains.some((m) => normalize(m) && list.includes(normalize(m)))
  )
}
