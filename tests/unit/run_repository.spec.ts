import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import Run from '#models/run'
import TaskSnapshot from '#models/task_snapshot'
import { RunRepository } from '#services/run_repository'
import type { RunTrigger } from '#services/run_repository'

const ZONE = 'Europe/Paris'
const NOW = DateTime.fromISO('2026-09-24T09:00:00', { zone: ZONE })

/** Un run minimal, daté, avec un instantané pour vérifier qu'il suit. */
async function run(day: string, trigger: RunTrigger, hour = 8) {
  const ranAt = DateTime.fromISO(`${day}T0${hour}:00:00`, { zone: ZONE })
  const created = await Run.create({
    ranAt,
    day,
    trigger,
    durationMs: 0,
    apiCalls: 0,
    totalTasks: 1,
    myTasks: 0,
    bugTasks: 0,
    blockers: 0,
    weekMs: 0,
    payload: '{}',
  })

  await TaskSnapshot.create({
    runId: created.id,
    taskId: `T-${day}-${trigger}`,
    ref: 'ROC-1',
    name: 'Une tâche',
    url: 'https://app.clickup.com/t/T1',
    envKey: 'S1',
    status: 'dev en cours',
    columnKey: 'dev_en_cours',
    assigneeIds: '[]',
    isMine: true,
    isBug: false,
    timeEstimateMs: 0,
    timeSpentMs: 0,
    myTimeMs: 0,
  })

  return created
}

test.group('RunRepository — référence du diff', (group) => {
  group.each.setup(async () => {
    await Run.query().delete()
  })

  test('sans aucun run, il n’y a rien à quoi comparer', async ({ assert }) => {
    assert.isNull(await new RunRepository().diffReference(NOW))
  })

  test('les runs du jour ne servent pas de référence', async ({ assert }) => {
    await run('2026-09-24', 'manual', 7)
    await run('2026-09-24', 'refresh', 8)

    assert.isNull(
      await new RunRepository().diffReference(NOW),
      'comparer la journée à elle-même ne dirait rien'
    )
  })

  test('à défaut de run planifié, le dernier d’avant aujourd’hui fait référence', async ({
    assert,
  }) => {
    await run('2026-09-22', 'manual')
    const veille = await run('2026-09-23', 'refresh', 9)
    await run('2026-09-24', 'manual')

    const reference = await new RunRepository().diffReference(NOW)

    assert.isNotNull(reference)
    assert.equal(reference!.at.toISO(), veille.ranAt.toISO())
    assert.lengthOf(reference!.tasks, 1, 'les instantanés du run suivent')
  })

  test('un run planifié l’emporte, même plus ancien', async ({ assert }) => {
    const planifie = await run('2026-09-20', 'scheduled')
    await run('2026-09-23', 'refresh')

    const reference = await new RunRepository().diffReference(NOW)

    assert.equal(
      reference!.at.toISO(),
      planifie.ranAt.toISO(),
      'un rafraîchissement ne déplace pas la référence'
    )
  })

  test('plusieurs runs planifiés : le plus récent', async ({ assert }) => {
    await run('2026-09-20', 'scheduled')
    const dernier = await run('2026-09-23', 'scheduled')

    const reference = await new RunRepository().diffReference(NOW)
    assert.equal(reference!.at.toISO(), dernier.ranAt.toISO())
  })
})

test.group('RunRepository — archives', (group) => {
  group.each.setup(async () => {
    await Run.query().delete()
  })

  test('une archive sans les champs récents reste lisible', async ({ assert }) => {
    /* Payload d'avant l'arrivée de listId, veille et thresholds. */
    const ancien = await Run.create({
      ranAt: NOW,
      day: '2026-09-24',
      trigger: 'manual',
      durationMs: 0,
      apiCalls: 0,
      totalTasks: 1,
      myTasks: 0,
      bugTasks: 0,
      blockers: 0,
      weekMs: 0,
      payload: JSON.stringify({ tasks: [{ id: 'T1', status: 'nouveau' }] }),
    })

    const report = new RunRepository().payloadOf(ancien)

    assert.equal(report.tasks[0].listId, '', 'listId comblé, donc jamais filtré')
    assert.isNull(report.veille)
    assert.deepEqual(report.comments, {})
    assert.deepEqual(report.blockers, [])
    assert.isNotNull(report.thresholds, 'les seuils retombent sur la configuration')
  })
})
