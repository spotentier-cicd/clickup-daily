import { ChevronRight } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from 'cn'
import { TaskRow } from '@/components/task_row'
import { PRIORITY_LABEL } from '@/lib/format'
import type { Grouping } from '@/lib/view'
import type { Report, ReportColumn, Task } from '@/lib/report'

interface TaskTableProps {
  tasks: Task[]
  columns: ReportColumn[]
  environments: Report['environments']
  branches: Report['branches']
  comments: Report['comments']
  generatedAt: string
  open: boolean
  onOpenChange: (open: boolean) => void
  grouping: Grouping
  onGroupingChange: (grouping: Grouping) => void
  /** Groupe vers lequel défiler, posé par un clic sur la silhouette du flux. */
  focus?: string | null
}

interface Groupe {
  key: string
  label: string
  color?: string
  tasks: Task[]
}

/**
 * « Le plateau » : tout ce qui n'est pas dans la file, replié par défaut.
 *
 * Remplace la grille de 6 colonnes × 5 onglets, qui produisait 30 rendus de
 * colonne pour 57 tâches — soit 1,9 tâche par colonne, donc surtout du vide.
 * Ici l'espace n'est plus un axe de disposition mais un simple regroupement.
 */
export function TaskTable({
  tasks,
  columns,
  environments,
  branches,
  comments,
  generatedAt,
  open,
  onOpenChange,
  grouping,
  onGroupingChange,
  focus,
}: TaskTableProps) {
  const groupes = grouper(tasks, grouping, columns, environments)

  return (
    <section className="mt-8">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="flex h-11 w-full items-center gap-2 border-t border-rule text-body text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className={cn('size-4 transition-transform', open && 'rotate-90')} />
        Le plateau
        <span className="tabular-nums">
          {tasks.length} autre{tasks.length > 1 ? 's' : ''} tâche{tasks.length > 1 ? 's' : ''}
        </span>
      </button>

      {open && (
        <div className="pb-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-label text-muted-foreground">Grouper par</span>
            <ToggleGroup
              type="single"
              size="sm"
              value={grouping}
              onValueChange={(value) => value && onGroupingChange(value as Grouping)}
            >
              <ToggleGroupItem value="statut" className="h-6 px-2 text-label">
                Statut
              </ToggleGroupItem>
              <ToggleGroupItem value="liste" className="h-6 px-2 text-label">
                Liste
              </ToggleGroupItem>
              <ToggleGroupItem value="espace" className="h-6 px-2 text-label">
                Espace
              </ToggleGroupItem>
              <ToggleGroupItem value="priorite" className="h-6 px-2 text-label">
                Priorité
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Le grand écran sert là où il y a 45 lignes à montrer, pas là où il y en a 10. */}
          <div className="tabular-nums xl:grid xl:grid-cols-2 xl:items-start xl:gap-x-8">
            {groupes.map((groupe) => (
              <section key={groupe.key} id={`groupe-${groupe.key}`} className="mb-4 min-w-0">
                <h3
                  className={cn(
                    'sticky top-[calc(var(--bar-h)+2rem)] z-20 flex h-7 items-center gap-2',
                    'border-b border-rule bg-background/95 text-label font-semibold tracking-[0.08em] text-muted-foreground uppercase backdrop-blur-sm',
                    focus === groupe.key && 'text-foreground'
                  )}
                >
                  {groupe.color && (
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ background: groupe.color }}
                    />
                  )}
                  <span className="truncate">{groupe.label}</span>
                  {groupe.tasks.length > 0 && (
                    <span className="ml-auto">{groupe.tasks.length}</span>
                  )}
                </h3>

                {/* L'absence se dit : un groupe vide coûte 28 px, pas un sixième d'écran. */}
                {groupe.tasks.length === 0 ? (
                  <p className="flex h-7 items-center text-label text-muted-foreground">
                    — rien en attente
                  </p>
                ) : (
                  <ul className="divide-y divide-rule">
                    {groupe.tasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        density="plateau"
                        branches={branches[task.id] ?? []}
                        comments={comments[task.id] ?? []}
                        column={columns.find((column) => column.key === task.column)}
                        generatedAt={generatedAt}
                      />
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function grouper(
  tasks: Task[],
  grouping: Grouping,
  columns: ReportColumn[],
  environments: Report['environments']
): Groupe[] {
  if (grouping === 'statut') {
    /* Les colonnes vides restent listées : leur absence se remarquerait moins que leur vide. */
    return columns.map((column) => ({
      key: column.key,
      label: column.label,
      color: column.color,
      tasks: tasks.filter((task) => task.column === column.key),
    }))
  }

  if (grouping === 'espace') {
    return environments
      .map((environment) => ({
        key: environment.key,
        label: environment.label,
        tasks: tasks.filter((task) => task.envKey === environment.key),
      }))
      .filter((groupe) => groupe.tasks.length > 0)
  }

  if (grouping === 'priorite') {
    const ordre = ['urgent', 'high', 'normal', 'low']
    return [...ordre, 'sans']
      .map((key) => ({
        key,
        label: PRIORITY_LABEL[key] ?? 'Sans priorité',
        tasks: tasks.filter((task) => (task.priority ?? 'sans') === key),
      }))
      .filter((groupe) => groupe.tasks.length > 0)
  }

  const parListe = new Map<string, Groupe>()
  for (const task of tasks) {
    const label = task.listName || '(sans liste)'
    const key = `${task.envKey}-${label}`
    const groupe = parListe.get(key) ?? { key, label, tasks: [] }
    groupe.tasks.push(task)
    parListe.set(key, groupe)
  }

  return [...parListe.values()].sort((a, b) => b.tasks.length - a.tasks.length)
}
