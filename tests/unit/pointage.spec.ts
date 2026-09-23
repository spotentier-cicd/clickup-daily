import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { buildPointage } from '#domain/rules/pointage'
import clickUpDailyConfig from '#config/clickup_daily'
import type { RawTimeEntry } from '#domain/rules/pointage'

const ZONE = 'Europe/Paris'
const CONFIG = clickUpDailyConfig.temps
const HOUR = 3_600_000
/* Mercredi : la semaine en cours va donc de lundi à mercredi. */
const NOW = DateTime.fromISO('2026-09-23T15:00:00', { zone: ZONE })

function entry(day: string, hours: number, taskId = 'T1'): RawTimeEntry {
  return {
    task: { id: taskId },
    duration: hours * HOUR,
    start: DateTime.fromISO(`${day}T09:00:00`, { zone: ZONE }).toMillis(),
  }
}

test.group('buildPointage', () => {
  test('la semaine s’arrête à aujourd’hui', ({ assert }) => {
    const pointage = buildPointage([], CONFIG, ZONE, NOW)
    assert.deepEqual(
      pointage.days.map((d) => d.date.toISODate()),
      ['2026-09-21', '2026-09-22', '2026-09-23']
    )
    assert.lengthOf(pointage.prevDays, 5, 'la semaine précédente est complète, lundi à vendredi')
  })

  test('additionne par jour et par tâche', ({ assert }) => {
    const pointage = buildPointage(
      [entry('2026-09-21', 3), entry('2026-09-21', 4, 'T2'), entry('2026-09-22', 7)],
      CONFIG,
      ZONE,
      NOW
    )

    assert.equal(pointage.days[0].ms, 7 * HOUR)
    assert.equal(pointage.byTask.T1, 10 * HOUR)
    assert.equal(pointage.byTask.T2, 4 * HOUR)
    assert.equal(pointage.weekMs, 14 * HOUR)
  })

  test('aujourd’hui n’est jamais compté comme incomplet', ({ assert }) => {
    const pointage = buildPointage([entry('2026-09-23', 1)], CONFIG, ZONE, NOW)
    const today = pointage.days.at(-1)!

    assert.isTrue(today.isToday)
    assert.equal(today.missingMs, 0, 'la journée n’est pas finie')
    assert.isEmpty(pointage.untracked.filter((d) => d.isToday))
    assert.isEmpty(pointage.partial.filter((d) => d.isToday))
  })

  test('distingue un jour vide d’un jour partiel', ({ assert }) => {
    const pointage = buildPointage([entry('2026-09-22', 4)], CONFIG, ZONE, NOW)

    assert.deepEqual(
      pointage.untracked.map((d) => d.date.toISODate()),
      ['2026-09-21']
    )
    assert.deepEqual(
      pointage.partial.map((d) => d.date.toISODate()),
      ['2026-09-22']
    )
    assert.equal(pointage.gapMs, 7 * HOUR + 3 * HOUR, 'lundi entier + les 3 h qui manquent mardi')
  })

  test('un minuteur encore lancé est signalé et pas additionné', ({ assert }) => {
    const pointage = buildPointage(
      [
        entry('2026-09-23', 2),
        { task: { id: 'T9', custom_id: 'ROC-99' }, duration: -12345, start: NOW.toMillis() },
      ],
      CONFIG,
      ZONE,
      NOW
    )

    assert.equal(pointage.running, 'ROC-99')
    assert.equal(pointage.weekMs, 2 * HOUR)
    assert.isUndefined(pointage.byTask.T9)
  })

  test('les jours hors week_days sont ignorés', ({ assert }) => {
    const samedi = DateTime.fromISO('2026-09-26T10:00:00', { zone: ZONE })
    const pointage = buildPointage([entry('2026-09-26', 5)], CONFIG, ZONE, samedi)

    assert.deepEqual(
      pointage.days.map((d) => d.date.toISODate()),
      ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25']
    )
    assert.equal(pointage.weekMs, 0, 'le samedi n’est pas un jour attendu')
  })

  test('la cible suit la configuration', ({ assert }) => {
    const pointage = buildPointage([], CONFIG, ZONE, NOW)
    assert.equal(pointage.targetMs, CONFIG.targetHoursPerDay * HOUR)
    assert.equal(pointage.weekTargetMs, 3 * CONFIG.targetHoursPerDay * HOUR)
  })
})
