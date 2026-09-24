import { useState } from 'react'
import { ArrowUpRight, Bug, ChevronDown, GitBranch, MessageSquare } from 'lucide-react'
import { cn } from 'cn'
import { branchState } from '#domain/git/types'
import {
  formatAge,
  formatDate,
  formatDuration,
  PRIORITY_DOT,
  PRIORITY_LABEL,
  TONE_RAIL,
  TONE_TEXT,
} from '@/lib/format'
import type { Branch, Comment, ReportColumn, Task } from '@/lib/report'

export type Ton = 'urgent' | 'attention' | 'muted'

interface TaskRowProps {
  task: Task
  /** « file » respire à 46 px, « plateau » serre à 30 px. Le contraste de densité EST le signal. */
  density: 'file' | 'plateau'
  branches: Branch[]
  comments: Comment[]
  column?: ReportColumn
  /** Rang dans la file : la page se lit comme un ordre de passage. */
  rank?: number
  /** Raisons du domaine, jointes — jamais tronquées à la première. */
  reasons?: string[]
  tone?: Ton
  /** Champs déjà classés par pertinence : les deux plus discriminants. */
  fields?: Task['customFields']
  /** Seuils du rapport, pour ne rien recopier côté client. */
  staleAfterDays?: number
  /**
   * L'instant du rapport, pas celui du navigateur.
   *
   * Une archive de mardi doit dire ce qu'elle disait mardi : calculer « dans
   * 2 j » sur l'horloge du client ferait vieillir le passé.
   */
  generatedAt: string
  /** La tâche a bougé depuis le rapport de référence. */
  moved?: boolean
}

/**
 * Une tâche est une LIGNE, pas une carte.
 *
 * Supprimer 57 bordures, 57 rayons et 57 ombres est précisément ce qui rend une
 * hiérarchie possible : quand tout est encadré, rien ne ressort.
 */
export function TaskRow({
  task,
  density,
  branches,
  comments,
  column,
  rank,
  reasons,
  tone = 'muted',
  fields = [],
  staleAfterDays,
  generatedAt,
  moved,
}: TaskRowProps) {
  const [open, setOpen] = useState(false)
  const detail = <TaskDetail task={task} branches={branches} comments={comments} />

  if (density === 'plateau') {
    return (
      <li>
        <div
          className="grid h-[30px] cursor-pointer grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-x-3 px-1 text-body hover:bg-muted/40"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="flex items-center gap-1.5">
            {task.priority && PRIORITY_DOT[task.priority] && (
              <span
                className={cn('size-[5px] shrink-0 rounded-full', PRIORITY_DOT[task.priority])}
                title={PRIORITY_LABEL[task.priority]}
              />
            )}
            <Reference task={task} />
          </span>

          <span className="truncate [font-variant-numeric:proportional-nums]">
            <a
              href={task.url}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="hover:underline"
            >
              {task.name}
            </a>
          </span>

          <span className="hidden items-center gap-3 text-label text-muted-foreground lg:flex">
            {task.isBug && <Bug className="size-3" />}
            <span className="w-28 truncate text-right">{task.listName}</span>
            <span className="w-12 text-right">{task.due ? formatDate(task.due) : ''}</span>
            <span className="w-16 text-right">{formatDuration(task.timeSpentMs)}</span>
          </span>
        </div>
        {open && detail}
      </li>
    )
  }

  return (
    <li>
      <div
        className={cn(
          'group relative grid cursor-pointer grid-cols-[2.25rem_minmax(0,1fr)_auto] items-baseline gap-x-3 py-2.5 pr-1',
          'before:absolute before:inset-y-1.5 before:left-0 before:w-[2px] before:rounded-full',
          'hover:bg-muted/40',
          TONE_RAIL[tone]
        )}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="pl-2.5 font-mono text-label text-muted-foreground/70 tabular-nums">
          {rank}
        </span>

        <span className="min-w-0">
          <span className="flex items-baseline gap-2">
            {task.priority && PRIORITY_DOT[task.priority] && (
              <span
                className={cn(
                  'size-[5px] shrink-0 self-center rounded-full',
                  PRIORITY_DOT[task.priority]
                )}
                title={PRIORITY_LABEL[task.priority]}
              />
            )}
            {moved && (
              <span
                className="shrink-0 self-center text-[10px] text-muted-foreground"
                title="a bougé depuis le dernier rapport"
              >
                ●
              </span>
            )}
            <Reference task={task} />
            <a
              href={task.url}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="truncate text-row font-medium [font-variant-numeric:proportional-nums] hover:underline"
            >
              {task.name}
            </a>
            {task.isBug && <Bug className="size-3 shrink-0 self-center text-muted-foreground" />}
          </span>

          <Reason
            task={task}
            reasons={reasons}
            tone={tone}
            staleAfterDays={staleAfterDays}
            generatedAt={generatedAt}
            fields={fields}
          />
        </span>

        <span className="hidden w-[13rem] shrink-0 text-right text-label text-muted-foreground tabular-nums lg:block">
          <span className="block truncate">
            {task.envLabel}
            {task.listName && ` · ${task.listName}`}
          </span>
          <span className="mt-0.5 flex items-center justify-end gap-1.5">
            {column && (
              <span className="size-1.5 rounded-full" style={{ background: column.color }} />
            )}
            {task.columnLabel}
            {!task.isMine && task.assignees.length > 0 && (
              <span className="max-w-24 truncate"> · {task.assignees.join(', ')}</span>
            )}
          </span>
        </span>

        <ArrowUpRight className="absolute top-3 right-0 size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-60" />
      </div>
      {open && detail}
    </li>
  )
}

/** La référence identifie, elle n'attire pas : elle est grise, pas bleue. */
function Reference({ task }: { task: Task }) {
  return (
    <a
      href={task.url}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => event.stopPropagation()}
      className="shrink-0 font-mono text-label font-semibold text-muted-foreground hover:text-foreground"
    >
      {task.ref}
    </a>
  )
}

/**
 * La deuxième ligne, en « premier vrai gagne ».
 *
 * S'il n'y a rien à dire, on n'écrit rien : une ligne vide coûte 20 px sur
 * chaque tâche et n'apprend rien.
 */
function Reason({
  task,
  reasons,
  tone,
  staleAfterDays,
  generatedAt,
  fields,
}: {
  task: Task
  reasons?: string[]
  tone: Ton
  staleAfterDays?: number
  generatedAt: string
  fields: Task['customFields']
}) {
  const contexte = fields.length > 0 && (
    <span className="ml-2 text-muted-foreground/80">
      {fields.map((field) => (
        <span key={field.name} title={field.name} className="ml-2">
          {field.value}
        </span>
      ))}
    </span>
  )

  /* Dans un blocage, TOUTES les raisons : le domaine les a cumulées exprès. */
  if (reasons && reasons.length > 0) {
    return (
      <span className={cn('mt-0.5 block truncate text-body', TONE_TEXT[tone])}>
        {reasons.join(' · ')}
        {contexte}
      </span>
    )
  }

  const dueSoon =
    task.due && !task.isOverdue
      ? Math.round((new Date(task.due).getTime() - new Date(generatedAt).getTime()) / 86_400_000)
      : null

  let texte: string | null = null
  let ton: Ton = 'muted'

  if (task.isOverdue) {
    texte = `en retard de ${task.overdueDays} j`
    ton = 'urgent'
  } else if (dueSoon !== null && dueSoon <= 3) {
    texte = dueSoon <= 0 ? "échéance aujourd'hui" : `échéance dans ${dueSoon} j`
    ton = 'attention'
  } else if (task.timeEstimateMs > 0 && task.timeSpentMs > task.timeEstimateMs) {
    texte = `pointé ${formatDuration(task.timeSpentMs)} / estim. ${formatDuration(task.timeEstimateMs)}`
    ton = 'attention'
  } else if (staleAfterDays && task.staleDays !== null && task.staleDays >= staleAfterDays) {
    texte = `modifiée ${formatAge(task.staleDays)}`
  }

  if (!texte && fields.length === 0) return null

  return (
    <span className={cn('mt-0.5 block truncate text-body', TONE_TEXT[ton])}>
      {texte}
      {contexte}
    </span>
  )
}

/** Le déplié : rien du contrat n'est perdu, tout est simplement rangé. */
function TaskDetail({
  task,
  branches,
  comments,
}: {
  task: Task
  branches: Branch[]
  comments: Comment[]
}) {
  return (
    <div className="space-y-3 border-t border-rule bg-muted/30 px-3 py-3 text-body">
      {task.description && <p className="line-clamp-3 text-muted-foreground">{task.description}</p>}

      {(task.timeSpentMs > 0 || task.timeEstimateMs > 0) && (
        <p
          className={cn(
            task.timeEstimateMs > 0 && task.timeSpentMs > task.timeEstimateMs && 'text-attention'
          )}
        >
          pointé {formatDuration(task.timeSpentMs) || '0'}
          {task.myTimeMs > 0 && ` (moi ${formatDuration(task.myTimeMs)})`}
          {task.timeEstimateMs > 0 && ` / estim. ${formatDuration(task.timeEstimateMs)}`}
        </p>
      )}

      {branches.length > 0 && (
        <ul className="space-y-0.5">
          {branches.map((branch) => (
            <li key={`${branch.repo}-${branch.name}`} className="flex items-center gap-1.5">
              <GitBranch className="size-3 shrink-0 text-muted-foreground" />
              <span className="truncate">
                <span className="text-muted-foreground">{branch.repo}</span> · {branch.name}
              </span>
              {/* branchState vient du domaine : pas de copie locale qui divergera. */}
              {branchState(branch) && (
                <span className="shrink-0 text-attention">— {branchState(branch)}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {comments.length > 0 && (
        <ul className="space-y-1">
          {comments.map((comment, index) => (
            <li key={index} className="flex gap-1.5">
              <MessageSquare className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
              <span className="line-clamp-2">
                <span className="font-medium">{comment.author}</span>{' '}
                <span className="text-muted-foreground">{comment.text}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {task.customFields.length > 0 && (
        <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-1">
          {task.customFields.map((field) => (
            <div key={field.name} className="contents">
              <dt className="truncate text-muted-foreground">{field.name.trim()}</dt>
              <dd className="truncate">{field.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

/** Le pied d'une section : ce qui dépasse le plafond se dit, il ne disparaît pas. */
export function MoreRow({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex h-7 w-full items-center gap-1.5 px-2.5 text-label text-muted-foreground hover:text-foreground"
      >
        <ChevronDown className="size-3.5" />+ {count} autre{count > 1 ? 's' : ''}
      </button>
    </li>
  )
}
