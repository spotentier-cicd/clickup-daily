import { useEffect, useMemo, useRef, useState } from 'react'
import { router } from '@inertiajs/react'
import { Check, Moon, RefreshCw, Search, ShieldAlert, Sun, SunMoon, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { MoreRow, TaskRow } from '@/components/task_row'
import { TaskTable } from '@/components/task_table'
import { ProjectPicker } from '@/components/project_picker'
import { ChangesInstrument, MentionsInstrument, PointageInstrument } from '@/components/instruments'
import { matchesSearch, rankFields } from '@/lib/filters'
import { filterReport, useProjectPreferences } from '@/lib/projects'
import { buildQueue, plateauOf } from '@/lib/queue'
import { readView, writeView } from '@/lib/view'
import { applyTheme, readTheme, type Theme } from '@/lib/theme'
import { cn } from 'cn'
import { shortLabels } from '#domain/text'
import {
  formatDate,
  formatDateTime,
  formatHours,
  formatLongDate,
  formatSignedHours,
} from '@/lib/format'
import type { FieldUsage, ProjectCatalog, ProjectPreferences } from '@/lib/projects'
import type { Report } from '@/lib/report'

interface DashboardProps {
  report: Report | null
  catalog: ProjectCatalog
  fields: FieldUsage[]
  preferences: ProjectPreferences
  days: { day: string; ranAt: string }[]
  day: string | null
  trigger: string | null
}

const THEME_ICON = { auto: SunMoon, light: Sun, dark: Moon }
const THEME_NEXT: Record<Theme, Theme> = { auto: 'light', light: 'dark', dark: 'auto' }

export default function Dashboard({
  report,
  catalog,
  fields,
  preferences,
  days,
  day,
}: DashboardProps) {
  const [search, setSearch] = useState('')
  const [facets, setFacets] = useState<string[]>([])
  const [theme, setTheme] = useState<Theme>(readTheme)
  const [view, setView] = useState(readView)
  const [refreshing, setRefreshing] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [focusGroup, setFocusGroup] = useState<string | null>(null)
  const [deployed, setDeployed] = useState<string[]>([])
  const searchRef = useRef<HTMLInputElement>(null)

  const projects = useProjectPreferences(preferences)

  useEffect(() => applyTheme(theme), [theme])
  useEffect(() => writeView(view), [view])

  /* Une seule cascade : périmètre, puis facettes et recherche, puis la file. */
  const selected = useMemo(
    () => (report ? filterReport(report, projects.preferences) : null),
    [report, projects.preferences]
  )

  const visible = useMemo(() => {
    if (!selected) return []
    return selected.tasks.filter(
      (task) =>
        (!facets.includes('mine') || task.isMine) &&
        (!facets.includes('bugs') || task.isBug) &&
        matchesSearch(task, search)
    )
  }, [selected, facets, search])

  const queue = useMemo(() => {
    if (!report || !selected) return null
    const blockers = selected.blockers.filter((blocker) =>
      visible.some((t) => t.id === blocker.task.id)
    )
    return buildQueue(
      { ...report, ...selected, tasks: visible },
      blockers,
      selected.diff.since ? formatDate(selected.diff.since) : ''
    )
  }, [report, selected, visible])

  /* Raccourcis : une lettre nue, jamais ⌘P qui est l'impression du navigateur. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const cible = event.target as HTMLElement | null
      const saisie =
        cible?.tagName === 'INPUT' || cible?.tagName === 'TEXTAREA' || cible?.isContentEditable
      if (saisie) {
        if (event.key === 'Escape') setSearch('')
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return

      if (event.key === '/') {
        event.preventDefault()
        searchRef.current?.focus()
      } else if (event.key === 'm') {
        setFacets((f) => (f.includes('mine') ? f.filter((x) => x !== 'mine') : [...f, 'mine']))
      } else if (event.key === 'p') {
        setPickerOpen((open) => !open)
      } else if (event.key === 'b') {
        setView((v) => ({ ...v, plateauOuvert: !v.plateauOuvert }))
      }
    }

    globalThis.addEventListener('keydown', onKey)
    return () => globalThis.removeEventListener('keydown', onKey)
  }, [])

  if (!report || !selected || !queue) return <EmptyState />

  const ThemeIcon = THEME_ICON[theme]
  const archive = days.length > 0 && day !== days[0].day
  const plateau = plateauOf(visible, queue)
  const filtre = facets.length > 0 || search.length > 0 || selected.hiddenCount > 0
  const blocages = queue.sections[0].entries.length

  const comptesParColonne = new Map(
    report.columns.map((column) => [
      column.key,
      visible.filter((task) => task.column === column.key).length,
    ])
  )
  const plusCharge = Math.max(...comptesParColonne.values())
  const abreges = shortLabels(report.columns.map((column) => column.label))

  const refresh = () =>
    router.post(
      '/refresh',
      {},
      { onStart: () => setRefreshing(true), onFinish: () => setRefreshing(false) }
    )

  const ouvrirGroupe = (key: string) => {
    setView((v) => ({ ...v, plateauOuvert: true, regroupement: 'statut' }))
    setFocusGroup(key)
    requestAnimationFrame(() =>
      document
        .querySelector(`#groupe-${key}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    )
  }

  return (
    <div
      className="mx-auto w-full max-w-[1400px] px-6"
      style={{ '--bar-h': '3rem' } as React.CSSProperties}
    >
      {/* BANDE 1 — la barre de commande */}
      <header className="sticky top-0 z-40 -mx-6 flex h-[var(--bar-h)] items-center gap-2 border-b border-rule bg-background/85 px-6 backdrop-blur-md">
        <span className="text-body font-semibold tracking-tight">clickup-daily</span>
        <span className="text-body text-muted-foreground first-letter:uppercase">
          {formatLongDate(report.generatedAt)}
        </span>
        {archive && (
          <span className="rounded bg-muted px-1.5 text-label text-muted-foreground">archive</span>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <div className="relative">
            <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher"
              className="h-7 w-56 pr-6 pl-7 text-body"
            />
            {!search && (
              <kbd className="absolute top-1/2 right-2 -translate-y-1/2 rounded border border-rule px-1 font-mono text-[10px] text-muted-foreground">
                /
              </kbd>
            )}
          </div>

          <ToggleGroup type="multiple" size="sm" value={facets} onValueChange={setFacets}>
            <ToggleGroupItem value="mine" className="h-7 px-2 text-label">
              Mes tâches
            </ToggleGroupItem>
            <ToggleGroupItem value="bugs" className="h-7 px-2 text-label">
              Bugs
            </ToggleGroupItem>
          </ToggleGroup>

          <ProjectPicker
            catalog={catalog}
            fields={fields}
            preferences={projects}
            hiddenCount={selected.hiddenCount}
            open={pickerOpen}
            onOpenChange={setPickerOpen}
          />

          <PointageInstrument pointage={report.pointage} />
          <ChangesInstrument diff={selected.diff} />
          <MentionsInstrument
            mentions={selected.mentions}
            lookbackDays={report.thresholds.mentionsLookbackDays}
          />

          <Separator orientation="vertical" className="h-5" />

          {days.length > 1 && (
            <Select
              value={day ?? ''}
              onValueChange={(value) => {
                globalThis.location.href = value === days[0].day ? '/' : `/r/${value}`
              }}
            >
              <SelectTrigger className="h-7 w-[7.5rem] text-label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {days.map((entry) => (
                  <SelectItem key={entry.day} value={entry.day} className="text-label">
                    {entry.day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setTheme(THEME_NEXT[theme])}
            title={`Thème : ${theme}`}
          >
            <ThemeIcon className="size-3.5" />
          </Button>

          <Button size="sm" className="h-7 gap-1.5" disabled={refreshing} onClick={refresh}>
            <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
            {refreshing ? 'Collecte…' : 'Rafraîchir'}
          </Button>
        </div>
      </header>

      {/* BANDE 2 — le verdict */}
      <section className="flex items-end gap-5 border-b border-rule py-3.5 tabular-nums">
        <span
          className={cn('text-verdict font-semibold', blocages > 0 ? 'text-urgent' : 'text-ok')}
        >
          {blocages}
        </span>
        <div className="min-w-0">
          <p className="text-label font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            {blocages > 1 ? 'Blocages' : 'Blocage'}
          </p>
          <p className="text-row text-muted-foreground">
            {blocages === 0 && (
              <span className="font-medium text-foreground">Rien ne bloque. </span>
            )}
            <span className="font-medium text-foreground">{selected.counts.mine}</span> tâches à moi
            {report.pointage && report.pointage.gapMs > 0 && (
              <>
                ,{' '}
                <span className="font-medium text-foreground">
                  {formatHours(report.pointage.gapMs)}
                </span>{' '}
                à rattraper
              </>
            )}
            .
          </p>
        </div>

        {/* La silhouette du flux : le bouchon se voit par le poids, pas par la couleur. */}
        <div className="ml-auto hidden items-baseline gap-2.5 text-label md:flex">
          {report.columns.map((column) => {
            const compte = comptesParColonne.get(column.key) ?? 0

            return (
              <button
                key={column.key}
                type="button"
                onClick={() => ouvrirGroupe(column.key)}
                className={cn(
                  'hover:text-foreground',
                  compte === plusCharge && compte > 0
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground'
                )}
                title={`${column.label} — ${compte}`}
              >
                {abreges.get(column.label)} <span className="tabular-nums">{compte}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* BANDE 3 — les filtres actifs, seulement s'il y en a */}
      {filtre && (
        <div className="sticky top-[var(--bar-h)] z-30 -mx-6 flex h-8 items-center gap-1.5 border-b border-rule bg-background/85 px-6 backdrop-blur-md">
          {facets.map((facet) => (
            <Chip key={facet} onClear={() => setFacets(facets.filter((f) => f !== facet))}>
              {facet === 'mine' ? 'mes tâches' : 'bugs'}
            </Chip>
          ))}
          {search && <Chip onClear={() => setSearch('')}>« {search} »</Chip>}
          {selected.hiddenCount > 0 && (
            <Chip onClear={projects.reset}>périmètre — {selected.hiddenCount} masquées</Chip>
          )}
          <span className="ml-1 text-label text-muted-foreground tabular-nums">
            {report.stats.total} → {visible.length} résultats
          </span>
        </div>
      )}

      {/* BANDE 4 — la file */}
      <div className="space-y-6 pt-5 tabular-nums">
        {queue.sections.map((section) => {
          const tout = deployed.includes(section.key)
          const montrees = tout ? section.entries : section.entries.slice(0, section.limit)
          const reste = section.entries.length - montrees.length
          const urgente = section.key === 'bloque'

          return (
            <section key={section.key}>
              <h2 className="flex h-7 items-center gap-2">
                {urgente ? (
                  <ShieldAlert className="size-3.5 text-muted-foreground" />
                ) : (
                  <Check className="size-3.5 text-muted-foreground" />
                )}
                <span className="text-label font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                  {section.title}
                </span>
                {section.entries.length > 0 && (
                  <span className="text-label text-muted-foreground tabular-nums">
                    {section.entries.length}
                  </span>
                )}
                <Separator className="flex-1" />
              </h2>

              <ul
                className={cn(
                  'divide-y divide-rule',
                  urgente &&
                    section.entries.length > 0 &&
                    'rounded-r-md border-l-2 border-urgent bg-surface-urgent'
                )}
              >
                {/* L'absence se dit, elle ne s'efface jamais. */}
                {section.entries.length === 0 && (
                  <li className="flex h-7 items-center gap-2 text-body text-muted-foreground">
                    <Check className="size-3.5 text-ok" />
                    {section.vide}
                  </li>
                )}

                {montrees.map((entry, index) => (
                  <TaskRow
                    key={entry.task.id}
                    task={entry.task}
                    density="file"
                    rank={index + 1}
                    reasons={entry.reasons}
                    tone={entry.tone}
                    moved={entry.moved}
                    branches={report.branches[entry.task.id] ?? []}
                    comments={report.comments[entry.task.id] ?? []}
                    column={report.columns.find((column) => column.key === entry.task.column)}
                    fields={rankFields(entry.task, fields, projects.preferences)}
                    staleAfterDays={report.thresholds.staleAfterDays}
                    generatedAt={report.generatedAt}
                  />
                ))}

                {reste > 0 && (
                  <MoreRow count={reste} onClick={() => setDeployed([...deployed, section.key])} />
                )}

                {/* Un filtre ne masque jamais un blocage en silence. */}
                {urgente && selected.hiddenBlockers.length > 0 && (
                  <li className="flex h-7 items-center gap-2 px-2.5 text-label text-muted-foreground">
                    {selected.hiddenBlockers.length} blocage
                    {selected.hiddenBlockers.length > 1 ? 's' : ''} dans un projet masqué
                    <button
                      type="button"
                      onClick={projects.reset}
                      className="text-urgent hover:underline"
                    >
                      afficher
                    </button>
                  </li>
                )}
              </ul>
            </section>
          )
        })}
      </div>

      {/* BANDE 5 — le plateau */}
      <TaskTable
        tasks={plateau}
        columns={report.columns}
        environments={report.environments}
        branches={report.branches}
        comments={report.comments}
        generatedAt={report.generatedAt}
        open={view.plateauOuvert}
        onOpenChange={(open) => setView((v) => ({ ...v, plateauOuvert: open }))}
        grouping={view.regroupement}
        onGroupingChange={(regroupement) => setView((v) => ({ ...v, regroupement }))}
        focus={focusGroup}
      />

      {/* BANDE 6 — le colophon */}
      <footer className="mt-10 border-t border-rule pt-3 pb-8 text-label text-muted-foreground tabular-nums">
        {report.stats.total} tâches · {report.stats.backlogExcluded} écartées du backlog
        {report.stats.outOfScope > 0 && ` · ${report.stats.outOfScope} hors colonne`} ·{' '}
        {selected.mentions.length} mention{selected.mentions.length > 1 ? 's' : ''} sur{' '}
        {report.thresholds.mentionsLookbackDays} j scrutés
        {report.pointage && ` · ${formatSignedHours(-report.pointage.gapMs)} de pointage`} ·
        collecté en {(report.stats.durationMs / 1000).toFixed(1)} s ({report.stats.apiCalls} appels)
        · {formatDateTime(report.generatedAt)}
      </footer>
    </div>
  )
}

function Chip({ children, onClear }: { children: React.ReactNode; onClear: () => void }) {
  return (
    <span className="flex h-6 items-center gap-1 rounded border border-rule px-1.5 text-label text-muted-foreground">
      {children}
      <button type="button" onClick={onClear} className="hover:text-foreground">
        <X className="size-3" />
      </button>
    </span>
  )
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="text-row font-semibold">clickup-daily</h1>
      <p className="mt-2 text-body text-muted-foreground">
        Aucun rapport enregistré pour l’instant. Lancez une collecte :
      </p>
      <pre className="mt-4 rounded-md border border-rule bg-muted px-3 py-2 text-left text-body">
        node ace daily:report
      </pre>
    </div>
  )
}
