import { useEffect, useMemo, useRef, useState } from 'react'
import { router } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { WarningCircle } from '@phosphor-icons/react'
import { Sidebar } from '@/components/sidebar'
import { Toolbar } from '@/components/toolbar'
import { ScopePopover } from '@/components/scope_popover'
import { Synthesis } from '@/components/synthesis'
import { TaskList } from '@/components/task_list'
import { TaskDetail } from '@/components/task_detail'
import { VeilleBoard } from '@/components/veille_board'
import { columnsOf, dressTask, environmentColors } from '@/lib/board'
import { followedListIds, followedSpaces } from '#domain/scope'
import { matchesSearch } from '@/lib/filters'
import { filterReport, useProjectPreferences } from '@/lib/projects'
import { buildTabs } from '@/lib/tabs'
import { readTab, writeTab } from '@/lib/view'
import { applyTheme, nextTheme, readTheme, type Theme } from '@/lib/theme'
import { formatDateTime } from '@/lib/format'
import type {
  FieldUsage,
  ProjectCatalog,
  ProjectPreferences,
  ScopePreferences,
} from '@/lib/projects'
import type { Report, VeilleArticle } from '@/lib/report'

/*
| LE TABLEAU DE BORD.
|
| Une colonne de navigation, une barre de commande, et une zone qui change de
| nature selon l'onglet : la synthèse du matin, une liste de tâches avec son
| panneau de détail, ou la veille.
|
| Tout le filtrage est UNE SEULE cascade, dans cet ordre : le périmètre (côté
| serveur, persisté), puis la recherche et « mes tâches », puis l'onglet. Les
| compteurs de la colonne de gauche sont calculés sur l'avant-dernier étage :
| ils disent donc ce que l'onglet contiendrait si on y allait, ce qui est la
| seule lecture utile.
*/

interface DashboardProps {
  report: Report | null
  catalog: ProjectCatalog
  fields: FieldUsage[]
  preferences: ProjectPreferences
  /** Périmètre réglé dans /parametres : il porte le filtre par type de ticket. */
  scope: ScopePreferences
  days: { day: string; ranAt: string }[]
  day: string | null
  trigger: string | null
}

export default function Dashboard({
  report,
  catalog,
  fields,
  preferences,
  scope,
  days,
  day,
}: DashboardProps) {
  const [tab, setTab] = useState(readTab)
  const [theme, setTheme] = useState<Theme>(readTheme)
  const [search, setSearch] = useState('')
  const [mineOnly, setMineOnly] = useState(false)
  const [scopeOpen, setScopeOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const projects = useProjectPreferences(preferences)

  useEffect(() => applyTheme(theme), [theme])

  /*
   * Le compteur de collecte : un rafraîchissement peut durer cinq secondes, et
   * un bouton qui ne dit rien pendant ce temps passe pour un bouton cassé. La
   * remise à zéro se fait au départ de la requête, pas ici : un setState nu
   * dans un effet déclenche un rendu en cascade.
   */
  useEffect(() => {
    if (!refreshing) return

    const timer = setInterval(() => setElapsed((seconds) => seconds + 1), 1000)
    return () => clearInterval(timer)
  }, [refreshing])

  /* Raccourcis : une lettre nue, jamais ⌘P qui est l'impression du navigateur. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable

      if (typing) {
        if (event.key === 'Escape') setSearch('')
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return

      if (event.key === '/') {
        event.preventDefault()
        searchRef.current?.focus()
      } else if (event.key === 'm') {
        setMineOnly((only) => !only)
      } else if (event.key === 'p') {
        setScopeOpen((open) => !open)
      }
    }

    globalThis.addEventListener('keydown', onKey)
    return () => globalThis.removeEventListener('keydown', onKey)
  }, [])

  const envColors = useMemo(
    () => environmentColors(report?.environments ?? []),
    [report?.environments]
  )

  /*
   * Les espaces du rapport que le paramétrage suit encore. Un rapport déjà
   * collecté peut en contenir d'autres — celui d'avant qu'on décoche Tempo,
   * ou une archive antérieure au réglage : ils ne s'affichent plus.
   */
  const environments = useMemo(() => {
    const followed = new Set(followedSpaces(scope))
    return (report?.environments ?? []).filter((env) => followed.has(env.key))
  }, [report?.environments, scope])

  const scoped = useMemo(
    () => (report ? filterReport(report, projects.preferences, scope) : null),
    [report, projects.preferences, scope]
  )

  const visible = useMemo(() => {
    if (!scoped) return []
    return scoped.tasks.filter((task) => (!mineOnly || task.isMine) && matchesSearch(task, search))
  }, [scoped, mineOnly, search])

  const dressed = useMemo(() => {
    if (!report) return new Map<string, ReturnType<typeof dressTask>>()
    const options = { report, fields, preferences: projects.preferences, envColors }
    return new Map(visible.map((task) => [task.id, dressTask(task, options)]))
  }, [report, visible, fields, projects.preferences, envColors])

  const tabs = useMemo(
    () =>
      buildTabs({
        visible,
        environments,
        envColors,
        blockers: scoped?.blockers.length ?? 0,
        veille: report?.veille ?? null,
      }),
    [visible, report, environments, envColors, scoped]
  )

  /* Le panneau de périmètre ne propose que ce qui est suivi. */
  const followedKeys = new Set(followedSpaces(scope))
  const visibleCatalog = {
    environments: catalog.environments.filter((env) => followedKeys.has(env.key)),
  }

  if (!report || !scoped) return <EmptyState />

  /* Un onglet disparu — la veille coupée, un espace retiré — ne bloque pas la page. */
  const current = tabs.find((entry) => entry.key === tab) ?? tabs[0]
  const inTab = current.filter ? visible.filter(current.filter) : []
  const groups = columnsOf(report.columns, inTab).map((group) => ({
    column: group.column,
    tasks: group.tasks.map((task) => dressed.get(task.id)!),
  }))

  const selectable = groups.flatMap((group) => group.tasks)
  const shown = selectable.find((entry) => entry.task.id === selected) ?? selectable[0] ?? null

  const articles = report.veille
    ? report.veille.articles.filter((article) => matchesArticle(article, search))
    : []

  const go = (key: string) => {
    setTab(key)
    writeTab(key)
    setSelected(null)
    globalThis.scrollTo({ top: 0 })
  }

  const refresh = () =>
    router.post(
      '/refresh',
      {},
      {
        onStart: () => {
          setElapsed(0)
          setRefreshing(true)
          setError(null)
        },
        onFinish: () => setRefreshing(false),
        onError: () => setError('La collecte a échoué — regardez la console du serveur.'),
      }
    )

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)]">
      <Sidebar
        tabs={tabs}
        active={current.key}
        onSelect={go}
        generatedAt={report.generatedAt}
        me={report.me.name}
        pointage={report.pointage}
        days={days}
        day={day}
        archive={days.length > 0 && day !== days[0].day}
      />

      <div className="flex min-w-0 flex-col">
        <Toolbar
          search={search}
          onSearch={setSearch}
          searchRef={searchRef}
          mineOnly={mineOnly}
          onMineOnly={() => setMineOnly((only) => !only)}
          refreshing={refreshing}
          elapsed={elapsed}
          onRefresh={refresh}
          error={error}
          theme={theme}
          onTheme={() => setTheme(nextTheme(theme))}
          scope={
            <ScopePopover
              catalog={visibleCatalog}
              fields={fields}
              projects={projects}
              envColors={envColors}
              hiddenByScope={scoped.hiddenByScope}
              open={scopeOpen}
              onOpenChange={setScopeOpen}
            />
          }
        />

        {followedListIds(scope).length === 0 && <NoScopeNotice />}
        {followedListIds(scope).length > 0 &&
          report.tasks.length > 0 &&
          scoped.hiddenByScope === report.tasks.length && <OutOfScopeNotice />}

        {current.key === 'today' && (
          <Synthesis
            report={report}
            scoped={scoped}
            visible={visible}
            environments={environments}
            envColors={envColors}
            onTab={go}
            onResetScope={projects.reset}
          />
        )}

        <main className="mx-auto w-full max-w-[1760px] px-7 pt-[22px] pb-7">
          {current.key === 'veille' && report.veille && (
            <VeilleBoard
              veille={report.veille}
              articles={articles}
              generatedAt={report.generatedAt}
            />
          )}

          {current.filter && groups.length === 0 && (
            <div
              className="py-16 text-center"
              style={{ font: '400 14px var(--font-body)', color: 'var(--muted)' }}
            >
              Aucune tâche ne correspond.
            </div>
          )}

          {current.filter && groups.length > 0 && (
            <div className="flex flex-wrap items-start gap-[22px]">
              <TaskList groups={groups} selected={shown?.task.id ?? null} onSelect={setSelected} />
              {shown && (
                <TaskDetail
                  dressed={shown}
                  column={report.columns.find((column) => column.key === shown.task.column)}
                />
              )}
            </div>
          )}
        </main>

        <Legend report={report} />
      </div>
    </div>
  )
}

/**
 * Aucun espace suivi.
 *
 * Le tableau continue d'afficher le dernier rapport — un rapport enregistré
 * reste vrai — mais plus rien ne sera collecté tant que le périmètre est vide.
 * Sans cette bande, l'écart entre « tout est décoché » et « tout s'affiche »
 * n'a aucune explication à portée de regard.
 */
function NoScopeNotice() {
  return (
    <div className="mx-auto w-full max-w-[1760px] px-7 pt-4">
      <div
        className="flex flex-wrap items-center gap-2 px-[14px] py-3"
        style={{
          borderRadius: 8,
          background: 'color-mix(in srgb, var(--amber) 10%, var(--color-surface))',
          boxShadow: '0 0 0 1px color-mix(in srgb, var(--amber) 35%, transparent)',
          font: '400 13px/1.5 var(--font-body)',
        }}
      >
        <WarningCircle size={16} color="var(--amber)" />
        <span>
          Aucune liste suivie : ce que vous voyez est le dernier rapport collecté, et la prochaine
          collecte ne ramènera rien.
        </span>
        <Link href="/parametres" style={{ color: 'var(--color-accent)', fontWeight: 500 }}>
          Choisir les listes
        </Link>
      </div>
    </div>
  )
}

/**
 * Le rapport affiché ne contient aucun espace suivi.
 *
 * C'est le cas d'une archive antérieure au paramétrage, ou d'un rapport
 * collecté avant qu'on change d'avis sur les espaces. Un écran vide sans
 * explication ressemblerait à une panne.
 */
function OutOfScopeNotice() {
  return (
    <div className="mx-auto w-full max-w-[1760px] px-7 pt-4">
      <div
        className="flex flex-wrap items-center gap-2 px-[14px] py-3"
        style={{
          borderRadius: 8,
          background: 'color-mix(in srgb, var(--amber) 10%, var(--color-surface))',
          boxShadow: '0 0 0 1px color-mix(in srgb, var(--amber) 35%, transparent)',
          font: '400 13px/1.5 var(--font-body)',
        }}
      >
        <WarningCircle size={16} color="var(--amber)" />
        <span>
          Ce rapport ne contient rien du périmètre actuel — il a été collecté avant, ou vous avez
          décoché ses listes depuis. Lancez une collecte pour le remettre à jour.
        </span>
        <Link href="/parametres" style={{ color: 'var(--color-accent)', fontWeight: 500 }}>
          Paramétrage
        </Link>
      </div>
    </div>
  )
}

/** Comment lire une ligne : la légende reste sous les yeux, pas dans un manuel. */
function Legend({ report }: { report: Report }) {
  return (
    <footer className="mx-auto mt-auto flex w-full max-w-[1760px] flex-col gap-[10px] px-7 pt-[18px] pb-9">
      <div className="rule" />
      <div
        className="flex flex-wrap items-center gap-x-5 gap-y-2"
        style={{ font: '400 12px var(--font-body)', color: 'var(--muted)' }}
      >
        <span className="flex items-center gap-[7px]">
          <span
            className="size-[14px]"
            style={{ borderRadius: 4, background: 'var(--mine)', boxShadow: 'var(--shadow-sm)' }}
          />
          teinte violette = assignée à vous
        </span>
        <span>liseré gauche = priorité</span>
        <Rail color="var(--red)" label="urgente" />
        <Rail color="var(--amber)" label="haute" />
        <Rail color="var(--prio-n)" label="normale" />
        <span className="flex-1" />
        <span className="num" style={{ color: 'var(--faint)' }}>
          {report.stats.total} tâches
          {report.stats.outOfScope > 0 && ` · ${report.stats.outOfScope} hors périmètre`} · collecté
          en {(report.stats.durationMs / 1000).toFixed(1)} s ({report.stats.apiCalls} appels) ·{' '}
          {formatDateTime(report.generatedAt)}
        </span>
      </div>
    </footer>
  )
}

function Rail({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-[6px]">
      <span className="h-[14px] w-[3px]" style={{ borderRadius: 2, background: color }} />
      {label}
    </span>
  )
}

/** La recherche mord sur ce qui identifie un article, comme sur une tâche. */
function matchesArticle(article: VeilleArticle, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true

  const haystack = [article.source, article.title, article.summary, ...article.highlights]
    .join(' ')
    .toLowerCase()

  return needle.split(/\s+/).every((word) => haystack.includes(word))
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-lg px-6 py-24 text-center">
      <h1 className="m-0" style={{ font: '500 24px/1.2 var(--font-heading)' }}>
        Point ClickUp
      </h1>
      <p style={{ font: '400 13.5px/1.6 var(--font-body)', color: 'var(--muted)' }}>
        Aucun rapport enregistré pour l’instant. Choisissez d’abord les espaces à suivre dans le{' '}
        <Link href="/parametres" style={{ color: 'var(--color-accent)' }}>
          paramétrage
        </Link>
        , puis lancez une collecte :
      </p>
      <pre
        className="px-3 py-2 text-left"
        style={{
          borderRadius: 8,
          background: 'var(--color-surface)',
          boxShadow: 'var(--shadow-sm)',
          font: '400 13px var(--mono)',
        }}
      >
        node ace daily:report
      </pre>
    </div>
  )
}
