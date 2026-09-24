import { type DateTime } from 'luxon'
import { asInt, msToDateTime } from '#domain/time'
import type { TempsConfig } from '#domain/config/types'

/*
| Ce que j'ai déclaré dans ClickUp : par tâche sur la période, et jour par jour
| sur la semaine en cours.
*/

export interface RawTimeEntry {
  task?: { id?: string | number; custom_id?: string | null }
  /** Négative quand le minuteur tourne encore. */
  duration?: string | number
  start?: string | number
}

export type PointageDayOf<D> = {
  date: D
  ms: number
  targetMs: number
  isToday: boolean
  /** Aujourd'hui n'est jamais compté comme incomplet : la journée n'est pas finie. */
  missingMs: number
}

export type PointageOf<D> = {
  /** Millisecondes par identifiant de tâche, sur temps.lookbackDays. */
  byTask: Record<string, number>
  days: PointageDayOf<D>[]
  prevDays: PointageDayOf<D>[]
  targetMs: number
  weekMs: number
  weekTargetMs: number
  prevMs: number
  prevTargetMs: number
  /** Ce qui manque sur les jours écoulés de la semaine. */
  gapMs: number
  /** Jours écoulés sans la moindre saisie. */
  untracked: PointageDayOf<D>[]
  /** Jours saisis mais en dessous de la cible. */
  partial: PointageDayOf<D>[]
  /** Référence de la tâche dont le minuteur tourne encore, le cas échéant. */
  running: string | null
}

export type PointageDay = PointageDayOf<DateTime>
export type Pointage = PointageOf<DateTime>

export function buildPointage(
  entries: RawTimeEntry[],
  config: TempsConfig,
  zone: string,
  now: DateTime
): Pointage {
  const targetMs = Math.round(config.targetHoursPerDay * 3_600_000)
  const weekDays = new Set(config.weekDays)

  const byTask: Record<string, number> = {}
  const byDay = new Map<string, number>()
  let running: string | null = null

  for (const entry of entries) {
    const duration = asInt(entry.duration)

    /* L'API rend une durée négative tant que le minuteur n'est pas arrêté. */
    if (duration < 0) {
      running = String(entry.task?.custom_id || entry.task?.id || '')
      continue
    }

    const taskId = String(entry.task?.id ?? '')
    if (taskId) byTask[taskId] = (byTask[taskId] ?? 0) + duration

    const started = msToDateTime(entry.start, zone)
    if (started) {
      const key = started.toISODate()!
      byDay.set(key, (byDay.get(key) ?? 0) + duration)
    }
  }

  const today = now.toISODate()
  const buildDay = (date: DateTime): PointageDay => {
    const isToday = date.toISODate() === today
    const ms = byDay.get(date.toISODate()!) ?? 0
    return { date, ms, targetMs, isToday, missingMs: isToday ? 0 : Math.max(0, targetMs - ms) }
  }

  /** Les jours attendus d'une tranche, en partant du lundi donné. */
  const week = (monday: DateTime, length: number): PointageDay[] => {
    const days: PointageDay[] = []
    for (let i = 0; i < length; i++) {
      const date = monday.plus({ days: i }).startOf('day')
      /* weekDays est en base 0 (lundi = 0), Luxon compte de 1 à 7. */
      if (!weekDays.has(date.weekday - 1)) continue
      days.push(buildDay(date))
    }
    return days
  }

  const monday = now.minus({ days: now.weekday - 1 }).startOf('day')
  const days = week(monday, now.weekday)
  const prevDays = week(monday.minus({ days: 7 }), 7)
  const sum = (list: PointageDay[], field: 'ms' | 'targetMs') =>
    list.reduce((total, day) => total + day[field], 0)

  return {
    byTask,
    days,
    prevDays,
    targetMs,
    weekMs: sum(days, 'ms'),
    weekTargetMs: sum(days, 'targetMs'),
    prevMs: sum(prevDays, 'ms'),
    prevTargetMs: sum(prevDays, 'targetMs'),
    gapMs: days.reduce((total, day) => total + day.missingMs, 0),
    untracked: days.filter((day) => !day.isToday && day.ms === 0),
    partial: days.filter((day) => !day.isToday && day.ms > 0 && day.missingMs > 0),
    running,
  }
}
