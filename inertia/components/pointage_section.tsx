import { cn } from 'cn'
import { formatDuration, formatWeekday, formatWorkDays } from '@/lib/format'
import type { Pointage } from '@/lib/report'

/**
 * Le pointage de la semaine. Aujourd'hui n'est jamais montré comme incomplet —
 * la journée n'est pas finie, et le signaler serait un faux reproche.
 */
export function PointageSection({ pointage }: { pointage: Pointage | null }) {
  if (!pointage) return null

  return (
    <section className="rounded-lg border p-4">
      <h2 className="flex items-baseline gap-2 text-sm font-semibold">
        <span aria-hidden>⏱️</span> Pointage
        <span className="ml-auto text-xs font-normal text-muted-foreground tabular-nums">
          {formatDuration(pointage.weekMs) || '0h'} / {formatDuration(pointage.weekTargetMs)} cette
          semaine
        </span>
      </h2>

      <ul className="mt-3 space-y-1.5">
        {pointage.days.map((day) => {
          const ratio = day.targetMs ? Math.min(1, day.ms / day.targetMs) : 0
          const incomplete = day.missingMs > 0

          return (
            <li key={day.date} className="flex items-center gap-3 text-xs">
              <span className={cn('w-10 shrink-0 capitalize', day.isToday && 'font-semibold')}>
                {formatWeekday(day.date)}
              </span>

              <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className={cn(
                    'block h-full rounded-full transition-all',
                    day.isToday ? 'bg-blue-500' : incomplete ? 'bg-amber-500' : 'bg-emerald-500'
                  )}
                  style={{ width: `${ratio * 100}%` }}
                />
              </span>

              <span className="w-24 shrink-0 text-right tabular-nums">
                {day.ms > 0 ? formatDuration(day.ms) : '—'}
                {incomplete && (
                  <span className="text-amber-600 dark:text-amber-400">
                    {' '}
                    −{formatDuration(day.missingMs)}
                  </span>
                )}
                {day.isToday && <span className="text-muted-foreground"> en cours</span>}
              </span>
            </li>
          )
        })}
      </ul>

      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t pt-3 text-xs">
        {pointage.gapMs > 0 && (
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground">Manquant</dt>
            <dd className="font-medium text-amber-600 tabular-nums dark:text-amber-400">
              {formatDuration(pointage.gapMs)} ({formatWorkDays(pointage.gapMs, pointage.targetMs)})
            </dd>
          </div>
        )}
        <div className="flex gap-1.5">
          <dt className="text-muted-foreground">Semaine passée</dt>
          <dd className="tabular-nums">
            {formatDuration(pointage.prevMs) || '0h'} / {formatDuration(pointage.prevTargetMs)}
          </dd>
        </div>
        {pointage.running && (
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground">Minuteur en cours</dt>
            <dd className="font-medium">{pointage.running}</dd>
          </div>
        )}
      </dl>
    </section>
  )
}
