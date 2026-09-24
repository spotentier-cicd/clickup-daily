import { ClockCounterClockwise, Timer } from '@phosphor-icons/react'
import { formatDuration, formatHours, formatWeekday, formatWorkDays, pluralize } from '@/lib/format'
import { CARD, KICKER } from '@/lib/styles'
import type { Pointage, Task } from '@/lib/report'

/*
| LE POINTAGE DE LA SEMAINE.
|
| Une jauge, cinq cases, et une phrase. Le trait vertical sur la jauge est
| l'information la plus chère de la carte : il dit ce qui était attendu à hier
| soir, donc si le retard est un retard ou seulement une journée en cours.
|
| Aujourd'hui n'est JAMAIS compté comme incomplet — la journée n'est pas
| finie. C'est la règle de buildPointage, on ne fait que la refléter.
*/

interface WeekCardProps {
  pointage: Pointage
  /** Mes tâches visibles, pour la liste des estimations dépassées. */
  mine: Task[]
}

export function WeekCard({ pointage, mine }: WeekCardProps) {
  const late = pointage.gapMs > 0
  const filled = pointage.weekTargetMs
    ? Math.min(100, (pointage.weekMs / pointage.weekTargetMs) * 100)
    : 0

  /* Ce qui était dû à la fin de la dernière journée révolue. */
  const expectedMs = pointage.days
    .filter((day) => !day.isToday)
    .reduce((total, day) => total + day.targetMs, 0)
  const expected = pointage.weekTargetMs ? (expectedMs / pointage.weekTargetMs) * 100 : 0

  const incomplete = [...pointage.untracked, ...pointage.partial]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day) => formatWeekday(day.date))

  const over = mine
    .filter((task) => task.timeEstimateMs > 0 && task.timeSpentMs > task.timeEstimateMs)
    .sort((a, b) => b.timeSpentMs / b.timeEstimateMs - a.timeSpentMs / a.timeEstimateMs)
    .slice(0, 5)

  return (
    <section style={CARD} className="flex flex-col gap-[14px]">
      <div className="flex items-center justify-between gap-2" style={KICKER}>
        <span className="flex items-center gap-2">
          <Timer size={15} />
          Pointage de la semaine
        </span>
        <span
          className="num"
          style={{
            font: '500 13px var(--mono)',
            letterSpacing: 0,
            textTransform: 'none',
            color: 'var(--color-text)',
          }}
        >
          {formatHours(pointage.weekMs)}
          <span style={{ color: 'var(--faint)' }}> / {formatHours(pointage.weekTargetMs)}</span>
        </span>
      </div>

      <div className="flex flex-col gap-[6px]">
        <div
          className="relative h-2 overflow-hidden"
          style={{ borderRadius: 4, background: 'var(--soft)' }}
        >
          <div
            className="absolute inset-y-0 left-0"
            style={{
              width: `${filled}%`,
              borderRadius: 4,
              background: late ? 'var(--amber)' : 'var(--green)',
            }}
          />
          <div
            className="absolute inset-y-0 w-[2px] opacity-70"
            style={{ left: `${expected}%`, background: 'var(--color-text)' }}
          />
        </div>
        <div style={{ font: '400 11.5px var(--font-body)', color: 'var(--faint)' }}>
          trait : {formatHours(expectedMs)} attendues à la fin d’hier
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(52px,1fr))] gap-[6px]">
        {pointage.days.map((day) => {
          const complete = day.missingMs === 0

          return (
            <div
              key={day.date}
              className="flex flex-col gap-1 px-[9px] py-2"
              style={{ borderRadius: 6, background: 'var(--soft)' }}
            >
              <span style={{ font: '500 11.5px var(--font-body)', color: 'var(--muted)' }}>
                {formatWeekday(day.date)}
                {day.isToday && ' · auj.'}
              </span>
              <span className="num" style={{ font: '500 14px var(--mono)' }}>
                {day.ms ? formatDuration(day.ms) : '—'}
              </span>
              <span
                className="num"
                style={{
                  font: '500 11.5px var(--mono)',
                  color: day.isToday ? 'var(--faint)' : complete ? 'var(--green)' : 'var(--red)',
                }}
              >
                {day.isToday
                  ? 'en cours'
                  : complete
                    ? 'complet'
                    : `−${formatDuration(day.missingMs)}`}
              </span>
            </div>
          )
        })}
      </div>

      <div
        className="flex items-center gap-2 px-[11px] py-[9px]"
        style={{
          borderRadius: 6,
          background: `color-mix(in srgb, ${late ? 'var(--amber)' : 'var(--green)'} 13%, transparent)`,
          font: '400 13px/1.4 var(--font-body)',
        }}
      >
        <ClockCounterClockwise size={15} color={late ? 'var(--amber)' : 'var(--green)'} />
        {late ? (
          <span>
            <strong style={{ fontWeight: 600 }}>{formatHours(pointage.gapMs)} à rattraper</strong>
            {' · '}
            soit {formatWorkDays(pointage.gapMs, pointage.targetMs)}
            {incomplete.length > 0 &&
              ` · ${incomplete.join(', ')} incomplet${incomplete.length > 1 ? 's' : ''}`}
          </span>
        ) : (
          <span>
            <strong style={{ fontWeight: 600 }}>Rien à rattraper</strong> · les journées révolues
            sont saisies
          </span>
        )}
      </div>

      <div
        className="flex flex-col gap-[5px]"
        style={{ font: '400 12.5px/1.4 var(--font-body)', color: 'var(--muted)' }}
      >
        <div>
          Semaine précédente ·{' '}
          <span className="num" style={{ color: 'var(--color-text)', fontFamily: 'var(--mono)' }}>
            {formatHours(pointage.prevMs)} / {formatHours(pointage.prevTargetMs)}
          </span>
        </div>
        {pointage.running && (
          <div className="flex items-center gap-[7px]">
            <span
              className="size-[7px] rounded-full"
              style={{
                background: 'var(--green)',
                boxShadow: '0 0 0 3px color-mix(in srgb, var(--green) 25%, transparent)',
              }}
            />
            Minuteur en cours ·{' '}
            <span style={{ fontFamily: 'var(--mono)', color: 'var(--ref)' }}>
              {pointage.running}
            </span>
          </div>
        )}
      </div>

      {over.length > 0 && (
        <div className="flex flex-col gap-[7px] pt-1">
          <div
            style={{
              font: '500 11px var(--font-body)',
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              color: 'var(--faint)',
            }}
          >
            {pluralize(over.length, 'estimation dépassée', 'estimations dépassées')}
          </div>
          {over.map((task) => (
            <a
              key={task.id}
              href={task.url}
              target="_blank"
              rel="noreferrer"
              className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-baseline gap-2"
              style={{ font: '400 13px/1.35 var(--font-body)' }}
            >
              <span className="num" style={{ font: '500 11.5px var(--mono)', color: 'var(--ref)' }}>
                {task.ref}
              </span>
              <span className="truncate">{task.name}</span>
              <span
                className="num"
                style={{ font: '400 11.5px var(--mono)', color: 'var(--muted)' }}
              >
                {formatDuration(task.timeSpentMs)}/{formatDuration(task.timeEstimateMs)}
              </span>
              <span
                className="num min-w-[40px] text-right"
                style={{ font: '500 11.5px var(--mono)', color: 'var(--red)' }}
              >
                +{Math.round((task.timeSpentMs / task.timeEstimateMs - 1) * 100)}%
              </span>
            </a>
          ))}
        </div>
      )}
    </section>
  )
}
