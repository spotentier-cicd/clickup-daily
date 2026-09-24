import {
  ArrowRight,
  ChatsCircle,
  Crosshair,
  CurrencyDollar,
  Eye,
  GitDiff,
  SignIn,
  SignOut,
  UserPlus,
  WarningOctagon,
} from '@phosphor-icons/react'
import { WeekCard } from '@/components/week_card'
import { dressReason } from '@/lib/reasons'
import { CARD, KICKER, REF } from '@/lib/styles'
import { formatDateTime, formatHours, formatLongDate, formatTime, formatUsd } from '@/lib/format'
import type { Icon } from '@phosphor-icons/react'
import type { FilteredReport } from '@/lib/projects'
import type { Report, ReportColumn, Task } from '@/lib/report'

/*
| LA SYNTHÈSE DU MATIN.
|
| L'onglet « Aujourd'hui » ne montre pas les tâches : il montre les décisions.
| Cinq cartes, dans l'ordre où les ignorer coûte le plus cher — ce qui bloque,
| ce que je dois au pointage, ce sur quoi je suis, ce qui a bougé, et qui
| m'attend.
|
| La colonne « À débloquer en premier » est la seule à porter une couleur de
| fond : c'est la seule qu'on ne peut pas se permettre de sauter.
*/

const REVIEW_COLUMN = 'revue_a_faire'

export interface Kpi {
  value: string | number
  label: string
  fg?: string
  bg?: string
  shadow?: string
  onClick: () => void
}

interface SynthesisProps {
  report: Report
  scoped: FilteredReport
  /** Tâches visibles après périmètre, recherche et facettes. */
  visible: Task[]
  /** Espaces suivis, dans l'ordre du rapport. */
  environments: { key: string; label: string }[]
  envColors: Map<string, string>
  onTab: (key: string) => void
  /** Rouvrir tout le périmètre, quand un blocage s'y trouve masqué. */
  onResetScope: () => void
  /** Ouvrir la fiche d'un ticket DANS l'application, pas dans un onglet. */
  onOpenTask: (id: string) => void
}

export function Synthesis({
  report,
  scoped,
  visible,
  environments,
  envColors,
  onTab,
  onResetScope,
  onOpenTask,
}: SynthesisProps) {
  const mine = visible.filter((task) => task.isMine)
  const reviews = visible.filter((task) => task.column === REVIEW_COLUMN && !task.isMine)
  const fresh = scoped.mentions.filter((entry) => entry.mention.isNew)

  const kpis: Kpi[] = [
    {
      value: scoped.blockers.length,
      label: 'à débloquer',
      fg: 'var(--red)',
      bg: 'color-mix(in srgb, var(--red) 10%, var(--color-surface))',
      shadow: '0 0 0 1px color-mix(in srgb, var(--red) 35%, transparent)',
      onClick: () => globalThis.scrollTo({ top: 0, behavior: 'smooth' }),
    },
    { value: visible.length, label: 'tâches', onClick: () => onTab('mine') },
    { value: mine.length, label: 'à moi', onClick: () => onTab('mine') },
    { value: reviews.length, label: 'revues en attente', onClick: () => onTab('mine') },
    {
      value: visible.filter((task) => task.isBug).length,
      label: 'bugs',
      onClick: () => onTab('bugs'),
    },
    ...(report.pointage && report.pointage.gapMs > 0
      ? [
          {
            value: formatHours(report.pointage.gapMs),
            label: 'à rattraper',
            fg: 'var(--amber)',
            onClick: () => globalThis.scrollTo({ top: 0, behavior: 'smooth' }),
          },
        ]
      : []),
    { value: fresh.length, label: 'mentions', onClick: () => globalThis.scrollTo({ top: 0 }) },
    ...environments.map((environment) => ({
      value: visible.filter((task) => task.envKey === environment.key).length,
      label: environment.label,
      onClick: () => onTab(environment.key),
    })),
    ...(report.veille
      ? [
          {
            value: report.veille.articles.filter((article) => article.isNew).length,
            label: 'nouveaux en veille',
            onClick: () => onTab('veille'),
          },
        ]
      : []),
    ...(report.claude && report.claude.totalUsd > 0
      ? [
          {
            value: formatUsd(report.claude.totalUsd),
            label: 'Claude ce mois',
            onClick: () => globalThis.scrollTo({ top: 0, behavior: 'smooth' as ScrollBehavior }),
          },
        ]
      : []),
  ].filter((kpi) => kpi.value !== 0)

  return (
    <section className="mx-auto flex w-full max-w-[1760px] flex-col gap-[22px] px-7 py-[30px]">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-[6px]">
        <h1
          className="m-0"
          style={{ font: '500 30px/1 var(--font-heading)', letterSpacing: '-0.02em' }}
        >
          Aujourd’hui
        </h1>
        <div
          className="first-letter:uppercase"
          style={{ font: '400 13.5px var(--font-body)', color: 'var(--muted)' }}
        >
          {formatLongDate(report.generatedAt)} · généré à {formatTime(report.generatedAt)}
          {report.me.name && ` · ${report.me.name}`}
        </div>
      </div>

      <div className="flex flex-wrap gap-[10px]">
        {kpis.map((kpi) => (
          <button
            key={kpi.label}
            type="button"
            onClick={kpi.onClick}
            className="kpi flex min-w-[96px] cursor-pointer flex-col items-start gap-[5px] border-0 px-[14px] pt-[11px] pb-[10px] text-left"
            style={{
              borderRadius: 8,
              background: kpi.bg ?? 'var(--color-surface)',
              boxShadow: kpi.shadow ?? 'var(--shadow-sm)',
              color: 'var(--color-text)',
            }}
          >
            <span
              className="num"
              style={{
                font: '500 22px/1 var(--font-heading)',
                letterSpacing: '-0.02em',
                color: kpi.fg ?? 'var(--color-text)',
              }}
            >
              {kpi.value}
            </span>
            <span style={{ font: '400 12px/1.2 var(--font-body)', color: 'var(--muted)' }}>
              {kpi.label}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,380px),1fr))] items-start gap-[14px]">
        <UnblockCard scoped={scoped} onReset={onResetScope} onOpenTask={onOpenTask} />
        {report.pointage && (
          <WeekCard pointage={report.pointage} mine={mine} onOpenTask={onOpenTask} />
        )}
        <FocusCard columns={report.columns} mine={mine} reviews={reviews} onOpenTask={onOpenTask} />
        <ChangesCard report={report} scoped={scoped} />
        <MentionsCard
          scoped={scoped}
          lookback={report.thresholds.mentionsLookbackDays}
          onOpenTask={onOpenTask}
        />
        {report.claude && report.claude.totalUsd > 0 && (
          <ClaudeCard claude={report.claude} tasks={scoped.tasks} onOpenTask={onOpenTask} />
        )}
      </div>

      {/* Les espaces et leur couleur, une fois, pour que les pastilles se lisent. */}
      <div
        className="flex flex-wrap items-center gap-x-5 gap-y-2"
        style={{ font: '400 12px var(--font-body)', color: 'var(--muted)' }}
      >
        {environments.map((environment) => (
          <span key={environment.key} className="flex items-center gap-2">
            <span
              className="size-[7px] rounded-full"
              style={{ background: envColors.get(environment.key) }}
            />
            {environment.label}
          </span>
        ))}
        <span style={{ color: 'var(--faint)' }}>
          collecté en {(report.stats.durationMs / 1000).toFixed(1)} s ·{' '}
          {formatDateTime(report.generatedAt)}
        </span>
      </div>
    </section>
  )
}

/**
 * À débloquer en premier.
 *
 * L'ordre vient de computeBlockers : ce qui bloque quelqu'un d'autre passe
 * devant ce qui ne bloque que moi. On n'y retouche pas ici.
 *
 * Un blocage masqué par le périmètre ne disparaît jamais en silence : il se
 * compte au pied de la carte, avec de quoi le retrouver.
 */
function UnblockCard({
  scoped,
  onReset,
  onOpenTask,
}: {
  scoped: FilteredReport
  onReset: () => void
  onOpenTask: (id: string) => void
}) {
  const entries = scoped.blockers.slice(0, 12)

  return (
    <section
      className="overflow-hidden"
      style={{
        background: 'color-mix(in srgb, var(--red) 7%, var(--color-surface))',
        borderRadius: 8,
        boxShadow: '0 0 0 1px color-mix(in srgb, var(--red) 30%, transparent)',
      }}
    >
      <div className="h-[2px]" style={{ background: 'var(--red)' }} />
      <div className="flex flex-col gap-[14px] px-[18px] pt-4 pb-[18px]">
        <div className="flex items-center gap-2" style={{ ...KICKER, color: 'var(--red)' }}>
          <WarningOctagon size={15} />À débloquer en premier
          <span className="num" style={{ fontFamily: 'var(--mono)', letterSpacing: 0 }}>
            {scoped.blockers.length}
          </span>
        </div>

        {entries.length === 0 ? (
          <p className="m-0" style={{ font: '400 13.5px var(--font-body)', color: 'var(--muted)' }}>
            Rien ne bloque ce matin.
          </p>
        ) : (
          <ol className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,330px),1fr))] gap-x-7 gap-y-[14px] p-0">
            {entries.map((blocker, index) => (
              <li
                key={blocker.task.id}
                className="grid grid-cols-[18px_minmax(0,1fr)] gap-x-2 gap-y-0"
              >
                <span
                  className="num"
                  style={{ font: '500 12px/20px var(--mono)', color: 'var(--faint)' }}
                >
                  {index + 1}
                </span>
                <div className="flex flex-col gap-[5px]">
                  <button
                    type="button"
                    onClick={() => onOpenTask(blocker.task.id)}
                    className="hoverable-ink cursor-pointer border-0 bg-transparent p-0 text-left"
                    style={{
                      font: '500 14px/1.4 var(--font-body)',
                      color: 'inherit',
                      textWrap: 'pretty',
                    }}
                  >
                    <span
                      className="mr-[7px]"
                      style={{ font: '500 12px var(--mono)', color: 'var(--ref)' }}
                    >
                      {blocker.task.ref}
                    </span>
                    {blocker.task.name}
                  </button>
                  <div className="flex flex-col gap-[3px]">
                    {blocker.reasons.map((reason) => {
                      const dressed = dressReason(reason)
                      const Glyph = dressed.icon

                      return (
                        <div
                          key={reason}
                          className="flex items-center gap-[6px]"
                          style={{
                            font: '400 12.5px/1.35 var(--font-body)',
                            color: dressed.color,
                          }}
                        >
                          <Glyph size={13} className="shrink-0" />
                          {dressed.text}
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ font: '400 11.5px var(--font-body)', color: 'var(--faint)' }}>
                    {blocker.task.envLabel} · {blocker.task.listName} · {blocker.task.columnLabel}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}

        {scoped.hiddenBlockers.length > 0 && (
          <div style={{ font: '400 12px var(--font-body)', color: 'var(--muted)' }}>
            {scoped.hiddenBlockers.length} blocage
            {scoped.hiddenBlockers.length > 1 ? 's' : ''} dans un projet masqué{' '}
            <button
              type="button"
              onClick={onReset}
              className="cursor-pointer border-0 bg-transparent p-0 underline"
              style={{ color: 'var(--red)' }}
            >
              afficher
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

/** Où j'en suis : mes tâches par colonne, puis ce qui attend ma relecture. */
function FocusCard({
  columns,
  mine,
  reviews,
  onOpenTask,
}: {
  columns: ReportColumn[]
  mine: Task[]
  reviews: Task[]
  onOpenTask: (id: string) => void
}) {
  const groups = columns
    .map((column) => ({ column, tasks: mine.filter((task) => task.column === column.key) }))
    .filter((group) => group.tasks.length > 0)

  return (
    <section style={CARD} className="flex flex-col gap-4">
      <div className="flex items-center gap-2" style={KICKER}>
        <Crosshair size={15} />
        Focus du jour
      </div>

      {groups.length === 0 && (
        <p className="m-0" style={{ font: '400 13.5px var(--font-body)', color: 'var(--muted)' }}>
          Aucune tâche à mon nom dans ce périmètre.
        </p>
      )}

      {groups.map(({ column, tasks }) => (
        <div key={column.key} className="flex flex-col gap-[6px]">
          <div
            className="flex items-center gap-[7px]"
            style={{ font: '500 12px var(--font-body)', color: 'var(--muted)' }}
          >
            <span className="size-2 rounded-full" style={{ background: column.color }} />
            {column.label}
            <span className="num" style={{ fontFamily: 'var(--mono)', color: 'var(--faint)' }}>
              {tasks.length}
            </span>
          </div>
          {tasks.map((task) => (
            <TitleLine key={task.id} task={task} onOpen={onOpenTask} />
          ))}
        </div>
      ))}

      {reviews.length > 0 && (
        <div className="rule-top flex flex-col gap-[6px] pt-3">
          <div
            className="flex items-center gap-[7px]"
            style={{ font: '500 12px var(--font-body)', color: 'var(--muted)' }}
          >
            <Eye size={13} />
            Revues de code à faire
            <span className="num" style={{ fontFamily: 'var(--mono)', color: 'var(--faint)' }}>
              {reviews.length}
            </span>
          </div>
          {reviews.map((task) => (
            <TitleLine key={task.id} task={task} trailing={task.assignees[0]} onOpen={onOpenTask} />
          ))}
        </div>
      )}
    </section>
  )
}

/**
 * Une ligne de ticket cliquable.
 *
 * Le bouton ouvre la fiche dans l'application. ClickUp reste accessible depuis
 * la fiche elle-même — c'est le seul endroit qui doit quitter le tableau.
 */
function TitleLine({
  task,
  trailing,
  onOpen,
}: {
  task: Task
  trailing?: string
  onOpen: (id: string) => void
}) {
  return (
    <div
      className="flex items-baseline gap-2 pl-[15px]"
      style={{ font: '400 13.5px/1.35 var(--font-body)' }}
    >
      <button
        type="button"
        onClick={() => onOpen(task.id)}
        className="hoverable-ink flex min-w-0 flex-1 cursor-pointer items-baseline gap-2 border-0 bg-transparent p-0 text-left"
        style={{ font: 'inherit', color: 'inherit' }}
      >
        <span style={REF}>{task.ref}</span>
        <span className="min-w-0 flex-1 truncate">{task.name}</span>
      </button>
      {trailing && (
        <span style={{ fontSize: 12, color: 'var(--muted)' }} className="shrink-0">
          {trailing}
        </span>
      )}
    </div>
  )
}

type ChangeGroup = {
  label: string
  icon: Icon
  color: string
  items: { key: string; ref: string; name: string; from?: string; to?: string }[]
}

/** Ce qui a bougé depuis le rapport de référence. */
function ChangesCard({ report, scoped }: { report: Report; scoped: FilteredReport }) {
  const groups: ChangeGroup[] = [
    {
      label: 'M’ont été assignées',
      icon: UserPlus,
      color: 'var(--color-accent)',
      items: scoped.diff.assignedToMe.map(plain),
    },
    {
      label: 'Entrées dans le périmètre',
      icon: SignIn,
      color: 'var(--green)',
      items: scoped.diff.entered.map(plain),
    },
    {
      label: 'Changements de statut',
      icon: GitDiff,
      color: 'var(--amber)',
      items: scoped.diff.statusChanged.map((change) => ({
        key: change.task.id,
        ref: change.task.ref,
        name: change.task.name,
        from: change.previousStatus,
        to: change.task.status,
      })),
    },
    {
      label: 'Sorties',
      icon: SignOut,
      color: 'var(--faint)',
      items: scoped.diff.left.map((exit) => ({
        key: exit.snapshot.id,
        ref: exit.snapshot.ref,
        name: exit.snapshot.name,
        from: exit.snapshot.status,
        to: exit.newStatus,
      })),
    },
  ].filter((group) => group.items.length > 0)

  return (
    <section style={CARD} className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2" style={KICKER}>
        <span className="flex items-center gap-2">
          <GitDiff size={15} />
          Changements
        </span>
        <span
          style={{
            font: '400 12px var(--font-body)',
            letterSpacing: 0,
            textTransform: 'none',
            color: 'var(--faint)',
          }}
        >
          {scoped.diff.since ? `depuis le ${formatDateTime(scoped.diff.since)}` : 'premier rapport'}
        </span>
      </div>

      {groups.length === 0 && (
        <p className="m-0" style={{ font: '400 13.5px var(--font-body)', color: 'var(--muted)' }}>
          {scoped.diff.since
            ? 'Rien n’a bougé depuis le rapport précédent.'
            : 'Premier rapport : rien à comparer.'}
        </p>
      )}

      {groups.map((group) => {
        const Glyph = group.icon

        return (
          <div key={group.label} className="flex flex-col gap-[6px]">
            <div
              className="flex items-center gap-[7px]"
              style={{ font: '500 12px var(--font-body)', color: 'var(--muted)' }}
            >
              <Glyph size={13} color={group.color} />
              {group.label}
              <span className="num" style={{ fontFamily: 'var(--mono)', color: 'var(--faint)' }}>
                {group.items.length}
              </span>
            </div>
            {group.items.map((item) => (
              <div
                key={item.key}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-[2px] pl-5"
                style={{ font: '400 13.5px/1.35 var(--font-body)' }}
              >
                <span style={REF}>{item.ref}</span>
                <span>{item.name}</span>
                {item.from && (
                  <span
                    className="inline-flex items-center gap-[5px]"
                    style={{ fontSize: 12, color: 'var(--muted)' }}
                  >
                    {item.from}
                    <ArrowRight size={11} />
                    <span style={{ color: 'var(--color-text)' }}>{item.to}</span>
                  </span>
                )}
              </div>
            ))}
          </div>
        )
      })}

      {/* Le rapport sait combien de tâches il a écartées : autant le dire ici. */}
      <div style={{ font: '400 11.5px var(--font-body)', color: 'var(--faint)' }}>
        {report.stats.total} tâches ramenées
        {report.stats.outOfScope > 0 &&
          ` · ${report.stats.outOfScope} écartées : statut non coché pour leur liste`}
      </div>
    </section>
  )
}

function plain(task: Task) {
  return { key: task.id, ref: task.ref, name: task.name }
}

/** Les commentaires qui me citent ou qui m'attendent. */
function MentionsCard({
  scoped,
  lookback,
  onOpenTask,
}: {
  scoped: FilteredReport
  lookback: number
  onOpenTask: (id: string) => void
}) {
  return (
    <section style={CARD} className="flex flex-col gap-[14px]">
      <div className="flex items-center gap-2" style={KICKER}>
        <ChatsCircle size={15} />
        On me parle
        <span
          className="num"
          style={{ fontFamily: 'var(--mono)', letterSpacing: 0, color: 'var(--faint)' }}
        >
          {scoped.mentions.length}
        </span>
      </div>

      {scoped.mentions.length === 0 ? (
        <p className="m-0" style={{ font: '400 13.5px var(--font-body)', color: 'var(--muted)' }}>
          Personne ne m’a cité sur les {lookback} derniers jours.
        </p>
      ) : (
        scoped.mentions.slice(0, 10).map(({ mention, task }) => (
          <div
            key={`${task.id}-${mention.when}-${mention.author}`}
            className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-[10px] gap-y-0"
          >
            <span
              className="grid size-7 place-items-center rounded-full"
              style={{
                font: '500 11px var(--font-body)',
                background: 'var(--tint)',
                color: 'var(--tint-ink)',
              }}
            >
              {initials(mention.author)}
            </span>
            <div className="flex flex-col gap-[3px]">
              <div
                className="flex flex-wrap items-center gap-x-[7px] gap-y-1"
                style={{ font: '400 12px var(--font-body)', color: 'var(--muted)' }}
              >
                <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>
                  {mention.author}
                </span>
                <span>{formatDateTime(mention.when)}</span>
                <button
                  type="button"
                  onClick={() => onOpenTask(task.id)}
                  className="hoverable-ink cursor-pointer border-0 bg-transparent p-0"
                  style={REF}
                >
                  {task.ref}
                </button>
                {mention.isNew && (
                  <span className="tag tag-accent" style={{ padding: '2px 7px', fontSize: 10.5 }}>
                    nouveau
                  </span>
                )}
                {mention.assigned && !mention.resolved && (
                  <span
                    className="tag"
                    style={{
                      padding: '2px 7px',
                      fontSize: 10.5,
                      background: 'color-mix(in srgb, var(--red) 16%, transparent)',
                      color: 'var(--red)',
                    }}
                  >
                    assigné à moi
                  </span>
                )}
              </div>
              <p
                className="m-0"
                style={{
                  font: '400 13px/1.5 var(--font-body)',
                  color: 'color-mix(in srgb, var(--color-text) 85%, transparent)',
                  textWrap: 'pretty',
                }}
              >
                {excerpt(mention.text)}
              </p>
            </div>
          </div>
        ))
      )}
    </section>
  )
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/** Un commentaire long se coupe : la carte n'est pas un fil de discussion. */
function excerpt(text: string): string {
  return text.length > 220 ? `${text.slice(0, 219).trimEnd()}…` : text
}

/**
 * Ce que les conversations Claude ont coûté ce mois-ci.
 *
 * Le montant est un ÉQUIVALENT au tarif de l'API, reconstitué depuis les
 * transcriptions locales. L'abonnement est à prix fixe : rien de tout cela
 * n'est prélevé, et la carte le dit plutôt que de laisser croire à une
 * facture.
 *
 * La part non rattachée est affichée telle quelle. Une conversation menée sur
 * une branche qui ne cite aucun ticket n'est répartie nulle part — mieux vaut
 * un total honnêtement incomplet qu'une imputation inventée.
 */
function ClaudeCard({
  claude,
  tasks,
  onOpenTask,
}: {
  claude: NonNullable<Report['claude']>
  tasks: Task[]
  onOpenTask: (id: string) => void
}) {
  const byRef = new Map(tasks.map((task) => [task.ref.toLowerCase(), task]))
  const top = Object.entries(claude.byRef)
    .map(([ref, usd]) => ({ usd, task: byRef.get(ref) }))
    .filter((row): row is { usd: number; task: Task } => Boolean(row.task))
    .slice(0, 5)

  return (
    <section style={CARD} className="flex flex-col gap-4">
      <div className="flex items-center gap-2" style={KICKER}>
        <CurrencyDollar size={15} />
        Claude ce mois-ci
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="num" style={{ font: '500 26px/1 var(--mono)', letterSpacing: '-0.02em' }}>
          {formatUsd(claude.totalUsd)}
        </span>
        {claude.todayUsd > 0 && (
          <span style={{ font: '400 13px var(--font-body)', color: 'var(--muted)' }}>
            dont {formatUsd(claude.todayUsd)} aujourd’hui
          </span>
        )}
      </div>

      <p className="m-0" style={{ font: '400 12px/1.5 var(--font-body)', color: 'var(--faint)' }}>
        Équivalent au tarif de l’API sur {claude.sessions} conversation
        {claude.sessions > 1 ? 's' : ''}. L’abonnement est à prix fixe : rien n’est facturé.
        Quelques appels auxiliaires ne sont pas transcrits — c’est un plancher.
      </p>

      {claude.byModel.length > 0 && (
        <div className="rule-top flex flex-col gap-[6px] pt-3">
          {claude.byModel.map((entry) => (
            <div
              key={entry.model}
              className="flex items-baseline justify-between gap-3"
              style={{ font: '400 12.5px var(--font-body)', color: 'var(--muted)' }}
            >
              <span className="truncate">{entry.model.replace(/^claude-/, '')}</span>
              <span className="num shrink-0" style={{ fontFamily: 'var(--mono)' }}>
                {formatUsd(entry.usd)}
              </span>
            </div>
          ))}
        </div>
      )}

      {top.length > 0 && (
        <div className="rule-top flex flex-col gap-[6px] pt-3">
          <div style={{ font: '500 12px var(--font-body)', color: 'var(--muted)' }}>
            Rattaché à un ticket
          </div>
          {top.map(({ task, usd }) => (
            <TitleLine key={task.id} task={task} trailing={formatUsd(usd)} onOpen={onOpenTask} />
          ))}
        </div>
      )}

      {claude.unattributedUsd > 0 && (
        <div
          className="flex items-baseline justify-between gap-3"
          style={{ font: '400 12.5px var(--font-body)', color: 'var(--faint)' }}
        >
          <span>Sans ticket identifié</span>
          <span className="num shrink-0" style={{ fontFamily: 'var(--mono)' }}>
            {formatUsd(claude.unattributedUsd)}
          </span>
        </div>
      )}

      {claude.unknownModels.length > 0 && (
        <p
          className="m-0"
          style={{ font: '400 12px/1.45 var(--font-body)', color: 'var(--amber)' }}
        >
          Hors total, tarif inconnu : {claude.unknownModels.join(', ')}
        </p>
      )}
    </section>
  )
}
