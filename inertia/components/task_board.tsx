import { TaskCard } from '@/components/task_card'
import type { Report, ReportColumn, Task } from '@/lib/report'

interface TaskBoardProps {
  tasks: Task[]
  columns: ReportColumn[]
  branches: Report['branches']
  comments: Report['comments']
  hiddenFields: string[]
}

/**
 * Les tâches en colonnes, dans l'ordre du workflow. Une colonne vide reste
 * affichée : son absence se remarquerait moins que son vide.
 */
export function TaskBoard({ tasks, columns, branches, comments, hiddenFields }: TaskBoardProps) {
  if (tasks.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Aucune tâche ici.</p>
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {columns.map((column) => {
        const inColumn = tasks.filter((task) => task.column === column.key)

        return (
          <section key={column.key} className="min-w-0">
            <h2
              className="mb-2 flex items-center gap-2 border-b-2 pb-1.5 text-xs font-semibold tracking-wide uppercase"
              style={{ borderColor: column.color }}
            >
              <span className="truncate">{column.label}</span>
              <span className="ml-auto shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground tabular-nums">
                {inColumn.length}
              </span>
            </h2>

            <div className="space-y-2">
              {inColumn.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  branches={branches[task.id] ?? []}
                  comments={comments[task.id] ?? []}
                  hiddenFields={hiddenFields}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
