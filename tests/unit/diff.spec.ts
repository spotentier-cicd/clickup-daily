import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { computeDiff, toSnapshot } from '#domain/rules/diff'
import type { TaskView } from '#domain/task/types'

const NOW = DateTime.fromISO('2026-09-23T09:00:00', { zone: 'Europe/Paris' })
const ME = 106607105

function task(id: string, overrides: Partial<TaskView> = {}): TaskView {
  return {
    id,
    ref: `ROC-${id}`,
    name: `Tâche ${id}`,
    url: `https://app.clickup.com/t/${id}`,
    envKey: 'ROC',
    envLabel: 'ROC',
    status: 'dev en cours',
    column: 'dev_en_cours',
    columnLabel: 'Dev en cours',
    columnOrder: 2,
    priority: null,
    assignees: [],
    assigneeIds: [],
    isMine: false,
    tags: [],
    listName: '',
    folderName: '',
    parent: null,
    due: null,
    updated: NOW,
    created: null,
    timeEstimate: '',
    timeEstimateMs: 0,
    timeSpentMs: 0,
    myTimeMs: 0,
    customFields: [],
    description: '',
    taskType: '',
    isBug: false,
    staleDays: 0,
    isOverdue: false,
    overdueDays: 0,
    ...overrides,
  }
}

test.group('computeDiff', () => {
  test('sans référence, rien n’est signalé comme nouveau', ({ assert }) => {
    const diff = computeDiff({ previous: null, current: [task('A')], meUserId: ME })

    assert.isNull(diff.since)
    assert.isEmpty(diff.entered)
    assert.isEmpty(diff.left)
  })

  test('repère les entrées, les sorties et les changements de statut', ({ assert }) => {
    const before = [toSnapshot(task('A')), toSnapshot(task('B', { status: 'a faire' }))]
    const diff = computeDiff({
      previous: { at: NOW.minus({ days: 1 }), tasks: before },
      current: [task('A'), task('B', { status: 'dev en cours' }), task('C')],
      meUserId: ME,
    })

    assert.deepEqual(
      diff.entered.map((t) => t.id),
      ['C']
    )
    assert.deepEqual(
      diff.statusChanged.map((c) => [c.task.id, c.previousStatus]),
      [['B', 'a faire']]
    )
    assert.isEmpty(diff.left)
  })

  test('une sortie porte son dernier statut connu quand on a pu le lire', ({ assert }) => {
    const diff = computeDiff({
      previous: {
        at: NOW.minus({ days: 1 }),
        tasks: [toSnapshot(task('A')), toSnapshot(task('B'))],
      },
      current: [task('A')],
      meUserId: ME,
      exitStatuses: { B: 'production' },
    })

    assert.deepEqual(
      diff.left.map((l) => [l.snapshot.id, l.newStatus]),
      [['B', 'production']]
    )
  })

  test('une sortie dont le statut est inconnu garde un point d’interrogation', ({ assert }) => {
    const diff = computeDiff({
      previous: { at: NOW.minus({ days: 1 }), tasks: [toSnapshot(task('B'))] },
      current: [],
      meUserId: ME,
    })

    assert.equal(diff.left[0].newStatus, '?')
  })

  test('un simple renommage de statut sans changement réel ne compte pas', ({ assert }) => {
    const diff = computeDiff({
      previous: { at: NOW, tasks: [toSnapshot(task('A', { status: 'Deployé sur recette' }))] },
      current: [task('A', { status: 'deploye sur recette' })],
      meUserId: ME,
    })

    assert.isEmpty(diff.statusChanged, 'la comparaison ignore casse et accents')
  })

  test('signale une nouvelle assignation à moi', ({ assert }) => {
    const diff = computeDiff({
      previous: { at: NOW, tasks: [toSnapshot(task('A', { assigneeIds: [999] }))] },
      current: [task('A', { assigneeIds: [999, ME] }), task('B', { assigneeIds: [ME] })],
      meUserId: ME,
    })

    assert.deepEqual(
      diff.assignedToMe.map((t) => t.id),
      ['A']
    )
    assert.deepEqual(
      diff.entered.map((t) => t.id),
      ['B'],
      'B est une entrée, pas une réassignation'
    )
  })

  test('rester assigné ne déclenche rien', ({ assert }) => {
    const diff = computeDiff({
      previous: { at: NOW, tasks: [toSnapshot(task('A', { assigneeIds: [ME] }))] },
      current: [task('A', { assigneeIds: [ME] })],
      meUserId: ME,
    })

    assert.isEmpty(diff.assignedToMe)
  })
})
