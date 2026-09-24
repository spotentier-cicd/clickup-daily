import { Link } from '@adonisjs/inertia/react'
import { GearSix } from '@phosphor-icons/react'
import { formatHours, formatLongDate, formatTime } from '@/lib/format'
import type { Tab } from '@/lib/tabs'
import type { Pointage } from '@/lib/report'

/*
| LA COLONNE DE GAUCHE.
|
| Trois blocs, dans cet ordre : où on est (le jour, moi), où on peut aller
| (les onglets), et la seule mesure qui vaut d'être sous les yeux en
| permanence — le pointage de la semaine, parce qu'il se rattrape mal après
| coup.
*/

interface SidebarProps {
  tabs: Tab[]
  active: string
  onSelect: (key: string) => void
  generatedAt: string
  me: string
  pointage: Pointage | null
  days: { day: string; ranAt: string }[]
  day: string | null
  archive: boolean
}

export function Sidebar({
  tabs,
  active,
  onSelect,
  generatedAt,
  me,
  pointage,
  days,
  day,
  archive,
}: SidebarProps) {
  return (
    <aside
      className="flex flex-col gap-[22px] overflow-auto px-[14px] pt-[22px] pb-[18px] lg:sticky lg:top-0 lg:h-screen"
      style={{ background: 'color-mix(in srgb, var(--color-surface) 55%, var(--color-bg))' }}
    >
      <div className="flex flex-col gap-1 px-2">
        <div className="flex items-center gap-2">
          <span
            className="flex-1"
            style={{ font: '500 18px/1.1 var(--font-heading)', letterSpacing: '-0.015em' }}
          >
            Point ClickUp
          </span>
          <Link
            href="/parametres"
            title="Paramétrage : espaces suivis et types de tickets"
            className="hoverable -mr-1 grid size-7 place-items-center rounded-md"
            style={{ color: 'var(--muted)' }}
          >
            <GearSix size={16} />
          </Link>
        </div>
        <div style={{ font: '400 12px/1.4 var(--font-body)', color: 'var(--muted)' }}>
          <span className="first-letter:uppercase">{formatLongDate(generatedAt)}</span> ·{' '}
          {formatTime(generatedAt)}
          {me && <br />}
          {me}
        </div>

        {/* Une archive doit se dire : rien d'autre ne distingue hier d'aujourd'hui. */}
        {archive && (
          <span
            className="tag mt-1 self-start"
            style={{ background: tintOf('var(--amber)'), color: 'var(--amber)' }}
          >
            archive
          </span>
        )}
      </div>

      {days.length > 1 && (
        <select
          className="input"
          style={{ fontSize: 12.5, minHeight: 32 }}
          value={day ?? ''}
          onChange={(event) => {
            const chosen = event.target.value
            globalThis.location.href = chosen === days[0].day ? '/' : `/r/${chosen}`
          }}
        >
          {days.map((entry) => (
            <option key={entry.day} value={entry.day}>
              {entry.day === days[0].day ? `${entry.day} — dernier` : entry.day}
            </option>
          ))}
        </select>
      )}

      <nav className="flex flex-col gap-[2px]">
        {tabs.map((tab) => {
          const current = tab.key === active
          const Glyph = tab.icon

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onSelect(tab.key)}
              className="hoverable flex w-full cursor-pointer items-center gap-[10px] rounded-lg border-0 px-[10px] py-2 text-left"
              style={{
                font: '500 13.5px/1 var(--font-body)',
                borderRadius: 8,
                background: current
                  ? 'color-mix(in srgb, var(--color-accent) 14%, transparent)'
                  : 'transparent',
                color: current ? 'var(--color-text)' : 'var(--muted)',
              }}
            >
              <Glyph
                size={16}
                weight={tab.color ? 'fill' : 'regular'}
                color={tab.color ?? (current ? 'var(--color-accent)' : 'var(--muted)')}
              />
              <span className="flex-1">{tab.label}</span>
              <span style={{ font: '500 11.5px/1 var(--mono)', color: 'var(--faint)' }}>
                {tab.count}
              </span>
            </button>
          )
        })}
      </nav>

      {pointage && <WeekGauge pointage={pointage} />}
    </aside>
  )
}

function WeekGauge({ pointage }: { pointage: Pointage }) {
  const late = pointage.gapMs > 0
  const filled = pointage.weekTargetMs
    ? Math.min(100, (pointage.weekMs / pointage.weekTargetMs) * 100)
    : 0

  return (
    <div
      className="mt-auto flex flex-col gap-[9px] px-3 py-[14px]"
      style={{ borderRadius: 8, background: 'var(--color-surface)', boxShadow: 'var(--shadow-sm)' }}
    >
      <div
        className="flex items-baseline justify-between"
        style={{
          font: '500 11px var(--font-body)',
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
        }}
      >
        Pointage
        <span
          className="num"
          style={{
            font: '500 12px var(--mono)',
            letterSpacing: 0,
            textTransform: 'none',
            color: 'var(--color-text)',
          }}
        >
          {formatHours(pointage.weekMs)}
          <span style={{ color: 'var(--faint)' }}> / {formatHours(pointage.weekTargetMs)}</span>
        </span>
      </div>

      <div
        className="relative h-[6px] overflow-hidden"
        style={{ borderRadius: 3, background: 'var(--soft)' }}
      >
        <div
          className="absolute inset-y-0 left-0"
          style={{
            width: `${filled}%`,
            borderRadius: 3,
            background: late ? 'var(--amber)' : 'var(--green)',
          }}
        />
      </div>

      <div
        style={{
          font: '500 12.5px var(--font-body)',
          color: late ? 'var(--amber)' : 'var(--green)',
        }}
      >
        {late ? `${formatHours(pointage.gapMs)} à rattraper` : 'semaine à jour'}
      </div>
    </div>
  )
}

function tintOf(color: string): string {
  return `color-mix(in srgb, ${color} 16%, transparent)`
}
