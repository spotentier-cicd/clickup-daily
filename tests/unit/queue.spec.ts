import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { buildQueue, plateauTasks } from '#domain/queue'
import type { TaskView } from '#domain/task/types'
import type { BlockerOf } from '#domain/rules/blockers'

const NOW = DateTime.fromISO('2026-09-24T09:00:00', { zone: 'Europe/Paris' })

function task(id: string, overrides: Partial<TaskView> = {}): TaskView {
  return {
    id,
    ref: `ROC-${id}`,
    name: `Tâche ${id}`,
    url: '',
    envKey: 'ROC',
    envLabel: 'ROC',
    status: 'dev en cours',
    column: 'dev_en_cours',
    columnLabel: 'Dev en cours',
    columnOrder: 2,
    priority: null,
    assignees: [],
    assigneeIds: [],
    isMine: true,
    tags: [],
    listId: 'L1',
    listName: '',
    folderId: '',
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
    taskType: 'Tâche',
    isBug: false,
    staleDays: 0,
    isOverdue: false,
    overdueDays: 0,
    ...overrides,
  }
}

function rapport(overrides: Partial<Parameters<typeof buildQueue<DateTime>>[0]> = {}) {
  return {
    tasks: [],
    mentions: [],
    diff: { since: null, entered: [], statusChanged: [], left: [], assignedToMe: [] },
    ...overrides,
  } as Parameters<typeof buildQueue<DateTime>>[0]
}

function blocage(t: TaskView, severity = 1): BlockerOf<DateTime> {
  return { task: t, reasons: ['échéance dépassée'], severity, age: 3 }
}

test.group('buildQueue', () => {
  test('trois sections, dans l’ordre du coût', ({ assert }) => {
    const queue = buildQueue(rapport(), [])

    assert.deepEqual(
      queue.sections.map((s) => s.key),
      ['bloque', 'change', 'encours']
    )
    assert.equal(queue.total, 0)
  })

  test('une tâche bloquée n’apparaît pas une seconde fois plus bas', ({ assert }) => {
    const t = task('A')
    const queue = buildQueue(
      rapport({
        tasks: [t],
        diff: { since: null, entered: [t], statusChanged: [], left: [], assignedToMe: [t] },
      }),
      [blocage(t)]
    )

    assert.lengthOf(queue.sections[0].entries, 1)
    assert.isEmpty(queue.sections[1].entries, 'déjà prise par les blocages')
    assert.isEmpty(queue.sections[2].entries)
    assert.equal(queue.total, 1)
  })

  test('« ce qui a changé » suit l’ordre assignation, mention, statut, entrée', ({ assert }) => {
    const assignee = task('assignee')
    const cite = task('cite')
    const statut = task('statut')
    const entree = task('entree')

    const queue = buildQueue(
      rapport({
        mentions: [
          {
            task: cite,
            mention: {
              taskId: 'cite',
              author: 'Alice',
              when: NOW,
              text: 'coucou',
              assigned: false,
              resolved: false,
              isNew: true,
            },
          },
        ],
        diff: {
          since: NOW,
          entered: [entree],
          statusChanged: [{ task: statut, previousStatus: 'a faire' }],
          left: [],
          assignedToMe: [assignee],
        },
      }),
      []
    )

    assert.deepEqual(
      queue.sections[1].entries.map((e) => e.task.id),
      ['assignee', 'cite', 'statut', 'entree']
    )
    assert.isTrue(queue.sections[1].entries.every((e) => e.moved))
  })

  test('une mention déjà vue ne remonte pas', ({ assert }) => {
    const t = task('A')
    const queue = buildQueue(
      rapport({
        mentions: [
          {
            task: t,
            mention: {
              taskId: 'A',
              author: 'Alice',
              when: NOW,
              text: '…',
              assigned: false,
              resolved: false,
              isNew: false,
            },
          },
        ],
      }),
      []
    )

    assert.isEmpty(queue.sections[1].entries)
  })

  test('« en cours chez moi » ne prend que mes tâches en dev ou en revue', ({ assert }) => {
    const queue = buildQueue(
      rapport({
        tasks: [
          task('mienne-dev'),
          task('mienne-revue', { column: 'revue_a_faire' }),
          task('mienne-recette', { column: 'recette' }),
          task('autrui', { isMine: false }),
        ],
      }),
      []
    )

    assert.deepEqual(
      queue.sections[2].entries.map((e) => e.task.id),
      ['mienne-dev', 'mienne-revue']
    )
  })

  test('les raisons du domaine sont transmises entières', ({ assert }) => {
    const t = task('A')
    const cumul: BlockerOf<DateTime> = {
      task: t,
      reasons: ['échéance dépassée depuis 2 j', '🔀 2 commits non poussés', 'attend une relecture'],
      severity: 1,
      age: 5,
    }

    const queue = buildQueue(rapport({ tasks: [t] }), [cumul])
    assert.lengthOf(queue.sections[0].entries[0].reasons, 3)
  })
})

test.group('plateauTasks', () => {
  test('ne garde que ce qui n’est pas dans la file', ({ assert }) => {
    const dans = task('dans')
    const hors = task('hors', { isMine: false })
    const queue = buildQueue(rapport({ tasks: [dans, hors] }), [])

    assert.deepEqual(
      plateauTasks([dans, hors], queue).map((t) => t.id),
      ['hors']
    )
  })
})
