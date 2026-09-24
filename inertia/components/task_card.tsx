import { Badge } from '@/components/ui/badge'
import { cn } from 'cn'
import { formatAge, formatDate, formatDuration, PRIORITY_CLASS, PRIORITY_LABEL } from '@/lib/format'
import type { Branch, Comment, Task } from '@/lib/report'

interface TaskCardProps {
  task: Task
  branches: Branch[]
  comments: Comment[]
}

/**
 * Une tâche, condensée : de quoi décider quoi faire sans ouvrir ClickUp.
 * Rien n'est affiché qui n'a pas de valeur — pas de ligne vide « échéance : — ».
 */
export function TaskCard({ task, branches, comments }: TaskCardProps) {
  const overEstimate = task.timeEstimateMs > 0 && task.timeSpentMs > task.timeEstimateMs

  return (
    <article className="group rounded-lg border bg-card p-3 text-card-foreground shadow-xs transition-colors hover:border-foreground/20">
      <header className="flex items-start justify-between gap-2">
        <a
          href={task.url}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs font-semibold text-primary hover:underline"
        >
          {task.ref}
        </a>
        <div className="flex shrink-0 items-center gap-1">
          {task.isBug && (
            <Badge
              variant="outline"
              className="border-red-500/30 bg-red-500/15 text-[10px] text-red-700 dark:text-red-400"
            >
              bug
            </Badge>
          )}
          {task.priority && (
            <Badge variant="outline" className={cn('text-[10px]', PRIORITY_CLASS[task.priority])}>
              {PRIORITY_LABEL[task.priority] ?? task.priority}
            </Badge>
          )}
        </div>
      </header>

      <h3 className="mt-1 text-sm leading-snug font-medium">
        <a href={task.url} target="_blank" rel="noreferrer" className="hover:underline">
          {task.name}
        </a>
      </h3>

      <dl className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {task.taskType && <dd>{task.taskType}</dd>}
        {task.assignees.length > 0 && <dd className="truncate">{task.assignees.join(', ')}</dd>}
        {task.due && (
          <dd className={cn(task.isOverdue && 'font-medium text-red-600 dark:text-red-400')}>
            {task.isOverdue
              ? `en retard de ${task.overdueDays} j`
              : `pour le ${formatDate(task.due)}`}
          </dd>
        )}
        {task.staleDays !== null && task.staleDays > 0 && (
          <dd>modifiée {formatAge(task.staleDays)}</dd>
        )}
      </dl>

      {(task.timeSpentMs > 0 || task.timeEstimateMs > 0) && (
        <p className="mt-1.5 text-xs">
          <span
            className={cn(
              'text-muted-foreground',
              overEstimate && 'font-medium text-red-600 dark:text-red-400'
            )}
          >
            {task.timeSpentMs > 0 ? `pointé ${formatDuration(task.timeSpentMs)}` : 'rien de pointé'}
            {task.myTimeMs > 0 && ` (moi ${formatDuration(task.myTimeMs)})`}
            {task.timeEstimateMs > 0 && ` / estim. ${formatDuration(task.timeEstimateMs)}`}
          </span>
        </p>
      )}

      {task.customFields.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1">
          {task.customFields.map((field) => (
            <li key={field.name}>
              <Badge variant="secondary" className="text-[10px] font-normal">
                <span className="text-muted-foreground">{field.name}</span>&nbsp;{field.value}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      {branches.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs">
          {branches.map((branch) => (
            <li
              key={`${branch.repo}-${branch.name}`}
              className="flex gap-1.5 text-muted-foreground"
            >
              <span aria-hidden>🔀</span>
              <span className="truncate">
                <span className="font-medium text-foreground/80">{branch.repo}</span> ·{' '}
                {branch.name}
                {branchNote(branch) && (
                  <span className="text-amber-600 dark:text-amber-400">
                    {' '}
                    — {branchNote(branch)}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {comments.length > 0 && (
        <ul className="mt-2 space-y-1 border-t pt-2 text-xs text-muted-foreground">
          {comments.map((comment, index) => (
            <li key={index} className="line-clamp-2">
              <span aria-hidden>💬</span>{' '}
              <span className="font-medium text-foreground/80">{comment.author}</span>{' '}
              {comment.text}
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

/** Ce qui mérite d'être dit sur une branche, ou rien si tout est poussé. */
function branchNote(branch: Branch): string {
  const bits: string[] = []
  if (!branch.upstream) bits.push('jamais poussée')
  else if (branch.ahead)
    bits.push(
      `${branch.ahead} commit${branch.ahead > 1 ? 's' : ''} non poussé${branch.ahead > 1 ? 's' : ''}`
    )
  if (branch.dirty)
    bits.push(
      `${branch.dirty} fichier${branch.dirty > 1 ? 's' : ''} modifié${branch.dirty > 1 ? 's' : ''}`
    )
  return bits.join(' · ')
}
