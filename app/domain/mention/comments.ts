import { normalize } from '#domain/text'
import { asInt, msToDateTime } from '#domain/time'
import { compareTasks } from '#domain/task/types'
import type { DateTime } from 'luxon'
import type { Mention } from '#domain/mention/types'
import type { TaskView } from '#domain/task/types'
import type { EnrichConfig, MentionsConfig } from '#domain/config/types'

/*
| Lecture des commentaires : qui me parle, et où aller chercher.
|
| Tout est pur. Les appels à l'API sont faits par l'appelant, qui passe ici les
| charges brutes telles qu'il les a reçues.
*/

export interface RawComment {
  id?: string
  date?: string | number
  resolved?: boolean
  user?: { id?: number | string; username?: string }
  assignee?: { id?: number | string } | null
  comment_text?: string
  comment?: { type?: string; text?: string; user?: { id?: number | string } }[]
}

/** Le texte d'un commentaire, que l'API le donne à plat ou en blocs. */
export function commentText(comment: RawComment): string {
  const text =
    comment.comment_text || (comment.comment ?? []).map((part) => part.text ?? '').join(' ')

  return text.split(/\s+/).filter(Boolean).join(' ')
}

/**
 * Une mention arrive comme un bloc { type: 'tag', user: {...} } ; on retombe
 * sur le texte quand ClickUp ne structure pas la citation.
 */
export function citesMe(comment: RawComment, meUserId: number, meName: string): boolean {
  for (const part of comment.comment ?? []) {
    if ((part.type === 'tag' || part.type === 'mention') && asInt(part.user?.id) === meUserId) {
      return true
    }
  }

  return Boolean(meName) && normalize(commentText(comment)).includes(`@${normalize(meName)}`)
}

/**
 * Tâches dont les commentaires sont affichés dans le rapport : les miennes et
 * les colonnes listées dans enrich.scope, les miennes d'abord, plafonnées par
 * enrich.maxTasks pour tenir le quota d'appels.
 */
export function displayTargets(tasks: TaskView[], config: EnrichConfig): TaskView[] {
  if (!config.comments) return []

  const scope = new Set<string>(config.scope)
  const inScope = (task: TaskView) => (scope.has('mine') && task.isMine) || scope.has(task.column)

  return tasks
    .filter(inScope)
    .sort((a, b) => Number(a.isMine === false) - Number(b.isMine === false) || compareTasks(a, b))
    .slice(0, config.maxTasks)
}

/**
 * Tâches balayées en plus, uniquement pour y chercher une mention : les plus
 * récemment modifiées, car un nouveau commentaire remonte la date de
 * modification de sa tâche. C'est un appel par tâche, donc le budget compte.
 */
export function mentionTargets(
  tasks: TaskView[],
  config: MentionsConfig,
  alreadyFetched: Set<string>
): TaskView[] {
  if (!config.enabled) return []

  return tasks
    .filter(
      (task) =>
        !alreadyFetched.has(task.id) &&
        task.staleDays !== null &&
        task.staleDays <= config.lookbackDays
    )
    .sort((a, b) => (b.updated?.toMillis() ?? 0) - (a.updated?.toMillis() ?? 0))
    .slice(0, config.scanMaxTasks)
}

export interface FindMentionsOptions {
  tasks: TaskView[]
  /** Commentaires bruts par identifiant de tâche. */
  comments: Record<string, RawComment[]>
  config: MentionsConfig
  meUserId: number
  meName: string
  zone: string
  now: DateTime
  /** Date du rapport précédent, pour marquer ce qui est nouveau. */
  since?: DateTime | null
}

/**
 * Commentaires qui me citent ou qui m'ont été assignés, toutes tâches
 * confondues. Un commentaire que j'ai écrit moi-même ne compte pas, sauf s'il
 * m'est assigné — auquel cas il attend bien une action de ma part.
 *
 * Tri : le non résolu d'abord, puis du plus récent au plus ancien.
 */
export function findMentions(options: FindMentionsOptions): { mention: Mention; task: TaskView }[] {
  const { tasks, comments, config, meUserId, meName, zone, now, since = null } = options
  if (!config.enabled) return []

  const horizon = now.minus({ days: config.lookbackDays })
  const byId = new Map(tasks.map((task) => [task.id, task]))
  const found: { mention: Mention; task: TaskView }[] = []

  for (const [taskId, taskComments] of Object.entries(comments)) {
    const task = byId.get(taskId)
    if (!task) continue

    for (const comment of taskComments) {
      const when = msToDateTime(comment.date, zone)
      if (!when || when < horizon) continue

      const authorId = asInt(comment.user?.id)
      const assigned = asInt(comment.assignee?.id) === meUserId

      if (!assigned && (authorId === meUserId || !citesMe(comment, meUserId, meName))) continue

      found.push({
        task,
        mention: {
          taskId,
          author: comment.user?.username ?? '?',
          when,
          text: commentText(comment),
          assigned,
          resolved: Boolean(comment.resolved),
          isNew: Boolean(since && when > since),
        },
      })
    }
  }

  return found.sort(
    (a, b) =>
      Number(a.mention.resolved) - Number(b.mention.resolved) ||
      (b.mention.when?.toMillis() ?? 0) - (a.mention.when?.toMillis() ?? 0)
  )
}
