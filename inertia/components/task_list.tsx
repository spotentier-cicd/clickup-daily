import { Bug, ChatCircle, GitBranch } from '@phosphor-icons/react'
import type { DressedTask } from '@/lib/board'
import type { ReportColumn } from '@/lib/report'

/*
| LA LISTE.
|
| Une ligne par tâche, groupées par colonne du workflow. Densité maximale :
| tout ce qui demande de la place — description, branches, commentaires — vit
| dans le panneau de détail, pas ici.
|
| Deux signaux de fond, et deux seulement : le liseré gauche dit la priorité,
| la teinte violette dit « c'est à moi ». La sélection, elle, se marque au
| filet d'accent — un troisième fond n'aurait plus rien voulu dire.
*/

interface TaskListProps {
  groups: { column: ReportColumn; tasks: DressedTask[] }[]
  selected: string | null
  onSelect: (id: string) => void
}

export function TaskList({ groups, selected, onSelect }: TaskListProps) {
  return (
    <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-[22px]">
      {groups.map(({ column, tasks }) => (
        <div key={column.key} className="flex flex-col gap-[2px]">
          <div className="flex items-center gap-2 px-[10px] pb-2">
            <span
              className="size-[9px] rounded-full"
              style={{ background: column.color, boxShadow: `0 0 10px ${column.color}` }}
            />
            <span style={{ font: '500 13.5px var(--font-body)' }}>{column.label}</span>
            <span className="num" style={{ font: '500 12px var(--mono)', color: 'var(--faint)' }}>
              {tasks.length}
            </span>
          </div>

          {tasks.map((dressed) => (
            <Row
              key={dressed.task.id}
              dressed={dressed}
              selected={dressed.task.id === selected}
              onSelect={onSelect}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function Row({
  dressed,
  selected,
  onSelect,
}: {
  dressed: DressedTask
  selected: boolean
  onSelect: (id: string) => void
}) {
  const { task } = dressed

  return (
    <button
      type="button"
      onClick={() => onSelect(task.id)}
      className="hoverable relative grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-0 py-[10px] pr-3 pl-4 text-left"
      style={{
        borderRadius: 8,
        fontFamily: 'var(--font-body)',
        color: 'var(--color-text)',
        background: selected
          ? 'color-mix(in srgb, var(--color-accent) 13%, var(--color-surface))'
          : dressed.mine
            ? 'var(--mine)'
            : 'transparent',
        boxShadow: selected ? '0 0 0 1px var(--color-accent)' : 'none',
      }}
    >
      <span
        className="absolute top-[10px] bottom-[10px] left-1 w-[3px]"
        style={{ borderRadius: 2, background: dressed.prioColor }}
      />

      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="num" style={{ font: '500 11.5px var(--mono)', color: 'var(--ref)' }}>
            {task.ref}
          </span>
          <span className="truncate" style={{ font: '500 14px/1.35 var(--font-body)' }}>
            {task.name}
          </span>
        </span>
        <span
          className="flex flex-wrap items-center gap-x-[10px] gap-y-[3px]"
          style={{ font: '400 12px var(--font-body)', color: 'var(--muted)' }}
        >
          <span className="flex items-center gap-[5px]">
            <span className="size-[6px] rounded-full" style={{ background: dressed.envColor }} />
            {task.envLabel}
          </span>
          <span className="truncate">{dressed.assignees}</span>
          {task.isBug && (
            <span className="flex items-center gap-[3px]" style={{ color: 'var(--red)' }}>
              <Bug size={12} />
              bug
            </span>
          )}
          {dressed.mine && <span style={{ color: 'var(--ref)' }}>moi</span>}
        </span>
      </span>

      <span
        className="flex items-center gap-3"
        style={{ font: '400 12px var(--font-body)', color: 'var(--faint)' }}
      >
        {dressed.due && (
          <span style={{ color: dressed.due.late ? 'var(--red)' : 'var(--muted)' }}>
            {dressed.due.short}
          </span>
        )}
        {dressed.time && (
          <span
            className="num"
            style={{
              fontFamily: 'var(--mono)',
              color: dressed.time.over ? 'var(--red)' : 'var(--muted)',
            }}
          >
            {dressed.time.short}
          </span>
        )}
        {dressed.branches.length > 0 && (
          <span
            className="flex items-center gap-[3px]"
            title="Branches locales"
            style={{
              color: dressed.branches.some((branch) => branch.warn)
                ? 'var(--amber)'
                : 'var(--faint)',
            }}
          >
            <GitBranch size={13} />
            {dressed.branches.length}
          </span>
        )}
        {dressed.comments.length > 0 && (
          <span className="flex items-center gap-[3px]" title="Commentaires">
            <ChatCircle size={13} />
            {dressed.comments.length}
          </span>
        )}
      </span>
    </button>
  )
}
