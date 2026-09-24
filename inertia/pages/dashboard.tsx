import { useEffect, useMemo, useState } from 'react'
import { Moon, RefreshCw, Sun, SunMoon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TaskBoard } from '@/components/task_board'
import { BlockersSection } from '@/components/blockers_section'
import { PointageSection } from '@/components/pointage_section'
import { ChangesSection } from '@/components/changes_section'
import { MentionsSection } from '@/components/mentions_section'
import { matchesSearch } from '@/lib/filters'
import { applyTheme, readTheme, type Theme } from '@/lib/theme'
import { formatDateTime, formatLongDate, pluralize } from '@/lib/format'
import type { Report, Task } from '@/lib/report'

interface DashboardProps {
  report: Report | null
  days: { day: string; ranAt: string }[]
  day: string | null
  trigger: string | null
}

const THEME_ICON = { auto: SunMoon, light: Sun, dark: Moon }
const THEME_NEXT: Record<Theme, Theme> = { auto: 'light', light: 'dark', dark: 'auto' }

export default function Dashboard({ report, days, day }: DashboardProps) {
  const [search, setSearch] = useState('')
  const [mineOnly, setMineOnly] = useState(false)
  /* Pas de SSR ici : le premier rendu a lieu dans le navigateur, donc on peut
     lire la préférence mémorisée dès l'initialisation de l'état. */
  const [theme, setTheme] = useState<Theme>(readTheme)

  useEffect(() => applyTheme(theme), [theme])

  const visible = useMemo(() => {
    if (!report) return []
    return report.tasks.filter((task) => (!mineOnly || task.isMine) && matchesSearch(task, search))
  }, [report, mineOnly, search])

  if (!report) return <EmptyState />

  const ThemeIcon = THEME_ICON[theme]
  const isArchive = days.length > 0 && day !== days[0].day
  const tabs = buildTabs(report, visible)

  return (
    <div className="mx-auto max-w-[1800px] px-4 py-5">
      <header className="mb-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-xl font-semibold tracking-tight">clickup-daily</h1>
          <p className="text-sm text-muted-foreground first-letter:uppercase">
            {formatLongDate(report.generatedAt)}
          </p>
          {isArchive && (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-700 dark:text-amber-400">
              archive
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTheme(THEME_NEXT[theme])}
              title={`Thème : ${theme}`}
            >
              <ThemeIcon className="size-4" />
              <span className="sr-only">Changer de thème</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => globalThis.location.reload()}>
              <RefreshCw className="size-4" />
              Recharger
            </Button>
          </div>
        </div>

        <p className="mt-1 text-xs text-muted-foreground">
          {pluralize(report.stats.total, 'tâche')} · {report.stats.mine} à moi · {report.stats.bugs}{' '}
          bugs · {report.stats.backlogExcluded} écartées du backlog · collecté en{' '}
          {(report.stats.durationMs / 1000).toFixed(1)} s ({report.stats.apiCalls} appels) ·{' '}
          {formatDateTime(report.generatedAt)}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher une référence, un titre, une personne…"
            className="h-8 max-w-sm"
          />
          <Button
            variant={mineOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMineOnly((value) => !value)}
          >
            Mes tâches
          </Button>
          {(search || mineOnly) && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {pluralize(visible.length, 'résultat')}
            </span>
          )}
          {days.length > 1 && (
            <select
              value={day ?? ''}
              onChange={(event) => {
                globalThis.location.href =
                  event.target.value === days[0].day ? '/' : `/r/${event.target.value}`
              }}
              className="ml-auto h-8 rounded-md border bg-background px-2 text-xs"
            >
              {days.map((entry) => (
                <option key={entry.day} value={entry.day}>
                  {entry.day}
                </option>
              ))}
            </select>
          )}
        </div>
      </header>

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <BlockersSection blockers={report.blockers} maxItems={12} />
        </div>
        <PointageSection pointage={report.pointage} />
        <ChangesSection diff={report.diff} />
        <div className="lg:col-span-2">
          <MentionsSection mentions={report.mentions} />
        </div>
      </div>

      <Tabs defaultValue={tabs[0].key}>
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key}>
              {tab.label}
              <span className="ml-1.5 text-[10px] text-muted-foreground tabular-nums">
                {tab.tasks.length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((tab) => (
          <TabsContent key={tab.key} value={tab.key} className="mt-4">
            <TaskBoard
              tasks={tab.tasks}
              columns={report.columns}
              branches={report.branches}
              comments={report.comments}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

/** Mes tâches et les bugs d'abord : c'est ce qu'on ouvre en premier. */
function buildTabs(report: Report, visible: Task[]) {
  return [
    { key: 'mine', label: '👤 Mes tâches', tasks: visible.filter((task) => task.isMine) },
    { key: 'bugs', label: '🐞 Bugs', tasks: visible.filter((task) => task.isBug) },
    ...report.environments.map((environment) => ({
      key: environment.key,
      label: environment.label,
      tasks: visible.filter((task) => task.envKey === environment.key),
    })),
  ]
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="text-xl font-semibold">clickup-daily</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Aucun rapport enregistré pour l’instant. Lancez une collecte :
      </p>
      <pre className="mt-4 rounded-md border bg-muted px-3 py-2 text-left text-xs">
        node ace daily:report
      </pre>
    </div>
  )
}
