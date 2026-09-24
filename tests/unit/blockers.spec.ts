import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { computeBlockers, SEVERITY } from '#domain/rules/blockers'
import clickUpDailyConfig from '#config/clickup_daily'
import type { TaskView } from '#domain/task/types'
import type { GitBranch } from '#domain/git/types'
import type { Mention } from '#domain/mention/types'

const NOW = DateTime.fromISO('2026-09-23T09:00:00', { zone: 'Europe/Paris' })
const CONFIG = clickUpDailyConfig.blockers
const STALE = clickUpDailyConfig.staleAfterDays

function task(overrides: Partial<TaskView> = {}): TaskView {
  return {
    id: 'T1',
    ref: 'ROC-1',
    name: 'Une tâche',
    url: 'https://app.clickup.com/t/T1',
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

function branch(overrides: Partial<GitBranch> = {}): GitBranch {
  return {
    repo: 'roc/api',
    name: 'feature/ROC-1_truc',
    lastCommit: NOW.minus({ days: 2 }),
    upstream: '',
    ahead: 0,
    behind: 0,
    isCurrent: false,
    dirty: 0,
    ...overrides,
  }
}

function mention(overrides: Partial<Mention> = {}): Mention {
  return {
    taskId: 'T1',
    author: 'Alice',
    when: NOW.minus({ days: 1 }),
    text: 'Tu peux regarder ?',
    assigned: true,
    resolved: false,
    isNew: false,
    ...overrides,
  }
}

test.group('computeBlockers — ce qui remonte', () => {
  test('une tâche tranquille ne remonte pas', ({ assert }) => {
    const blockers = computeBlockers({
      tasks: [task()],
      config: CONFIG,
      staleAfterDays: STALE,
      now: NOW,
    })
    assert.isEmpty(blockers)
  })

  test('mon échéance dépassée remonte', ({ assert }) => {
    const [blocker] = computeBlockers({
      tasks: [task({ isOverdue: true, overdueDays: 3, due: NOW.minus({ days: 3 }) })],
      config: CONFIG,
      staleAfterDays: STALE,
      now: NOW,
    })
    assert.equal(blocker.severity, SEVERITY.overdue)
    assert.include(blocker.reasons[0], '3 j')
  })

  test('une revue qui attend MA relecture remonte, pas la mienne propre', ({ assert }) => {
    const blockers = computeBlockers({
      tasks: [
        task({ id: 'A', column: 'revue_a_faire', isMine: false, assignees: ['Bob'], staleDays: 4 }),
        task({ id: 'B', column: 'revue_a_faire', isMine: false, staleDays: 1 }),
      ],
      config: CONFIG,
      staleAfterDays: STALE,
      now: NOW,
    })

    assert.lengthOf(blockers, 1, 'une seule dépasse review_wait_days')
    assert.equal(blockers[0].task.id, 'A')
    assert.equal(blockers[0].severity, SEVERITY.blockingSomeoneElse)
    assert.include(blockers[0].reasons[0], 'Bob')
  })

  test('des commits non poussés sur ma tâche en cours remontent', ({ assert }) => {
    const [blocker] = computeBlockers({
      tasks: [task({ id: 'T1' })],
      config: CONFIG,
      staleAfterDays: STALE,
      now: NOW,
      branchesByTask: { T1: [branch({ upstream: 'origin/feature', ahead: 2 })] },
    })
    assert.equal(blocker.severity, SEVERITY.unpushedWork)
    assert.include(blocker.reasons[0], '2 commits non poussés')
  })

  test('une branche entièrement poussée ne remonte pas', ({ assert }) => {
    const blockers = computeBlockers({
      tasks: [task({ id: 'T1' })],
      config: CONFIG,
      staleAfterDays: STALE,
      now: NOW,
      branchesByTask: { T1: [branch({ upstream: 'origin/feature', ahead: 0 })] },
    })
    assert.isEmpty(blockers)
  })

  test('ma tâche sans activité puis sur recette remontent à leurs seuils', ({ assert }) => {
    const stale = computeBlockers({
      tasks: [task({ staleDays: STALE })],
      config: CONFIG,
      staleAfterDays: STALE,
      now: NOW,
    })
    assert.equal(stale[0].severity, SEVERITY.stale)

    const recette = computeBlockers({
      tasks: [task({ column: 'recette', staleDays: CONFIG.recetteWaitDays })],
      config: CONFIG,
      staleAfterDays: STALE,
      now: NOW,
    })
    assert.equal(recette[0].severity, SEVERITY.recette)
  })

  test('une tâche qui n’est pas la mienne ne déclenche que le blocage de revue', ({ assert }) => {
    const blockers = computeBlockers({
      tasks: [
        task({ isMine: false, isOverdue: true, overdueDays: 9, staleDays: 99, column: 'recette' }),
      ],
      config: CONFIG,
      staleAfterDays: STALE,
      now: NOW,
    })
    assert.isEmpty(blockers, 'le retard et la recette ne concernent que mes tâches')
  })
})

test.group('computeBlockers — ordre et cumul', () => {
  test('ce qui bloque quelqu’un d’autre passe devant ce qui ne bloque que moi', ({ assert }) => {
    const blockers = computeBlockers({
      tasks: [
        task({ id: 'recette', column: 'recette', staleDays: 30 }),
        task({ id: 'revue_autrui', column: 'revue_a_faire', isMine: false, staleDays: 3 }),
        task({ id: 'retard', isOverdue: true, overdueDays: 1, due: NOW.minus({ days: 1 }) }),
      ],
      config: CONFIG,
      staleAfterDays: STALE,
      now: NOW,
      mentions: [
        { mention: mention({ taskId: 'commentaire' }), task: task({ id: 'commentaire' }) },
      ],
    })

    assert.deepEqual(
      blockers.map((b) => b.task.id),
      ['commentaire', 'retard', 'revue_autrui', 'recette']
    )
  })

  test('une tâche cumule ses raisons et garde la plus grave', ({ assert }) => {
    const [blocker] = computeBlockers({
      tasks: [
        task({
          id: 'T1',
          column: 'revue_a_faire',
          isMine: true,
          isOverdue: true,
          overdueDays: 2,
          staleDays: 5,
        }),
      ],
      config: CONFIG,
      staleAfterDays: STALE,
      now: NOW,
      branchesByTask: { T1: [branch({ ahead: 1, upstream: 'origin/x' })] },
    })

    assert.lengthOf(blocker.reasons, 3, 'échéance, branche non poussée, revue en attente')
    assert.equal(blocker.severity, SEVERITY.overdue, 'la plus grave des trois')
    assert.equal(blocker.age, 5, 'l’ancienneté la plus élevée')
  })

  test('un commentaire résolu ou non assigné ne remonte pas', ({ assert }) => {
    const blockers = computeBlockers({
      tasks: [],
      config: CONFIG,
      staleAfterDays: STALE,
      now: NOW,
      mentions: [
        { mention: mention({ resolved: true }), task: task({ id: 'A' }) },
        { mention: mention({ assigned: false }), task: task({ id: 'B' }) },
      ],
    })
    assert.isEmpty(blockers)
  })

  test('à gravité égale, le plus ancien passe devant', ({ assert }) => {
    const blockers = computeBlockers({
      tasks: [
        task({ id: 'recent', isOverdue: true, overdueDays: 1, due: NOW.minus({ days: 1 }) }),
        task({ id: 'ancien', isOverdue: true, overdueDays: 12, due: NOW.minus({ days: 12 }) }),
      ],
      config: CONFIG,
      staleAfterDays: STALE,
      now: NOW,
    })
    assert.deepEqual(
      blockers.map((b) => b.task.id),
      ['ancien', 'recent']
    )
  })
})
