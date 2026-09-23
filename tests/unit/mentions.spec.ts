import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import {
  citesMe,
  commentText,
  displayTargets,
  findMentions,
  mentionTargets,
} from '#domain/mention/comments'
import clickUpDailyConfig from '#config/clickup_daily'
import type { RawComment } from '#domain/mention/comments'
import type { TaskView } from '#domain/task/types'

const ZONE = 'Europe/Paris'
const NOW = DateTime.fromISO('2026-09-23T09:00:00', { zone: ZONE })
const ME = 106607105
const ME_NAME = 'Sylvain'

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

function comment(overrides: Partial<RawComment> = {}): RawComment {
  return {
    date: NOW.minus({ days: 1 }).toMillis(),
    user: { id: 999, username: 'Alice' },
    comment_text: 'Un commentaire',
    ...overrides,
  }
}

test.group('commentText', () => {
  test('recolle les blocs quand le texte à plat manque', ({ assert }) => {
    assert.equal(
      commentText({ comment: [{ text: 'Peux-tu' }, { text: 'regarder ?' }] }),
      'Peux-tu regarder ?'
    )
  })

  test('réduit les espaces multiples', ({ assert }) => {
    assert.equal(commentText({ comment_text: '  trop   d’espaces \n ici ' }), 'trop d’espaces ici')
  })
})

test.group('citesMe', () => {
  test('reconnaît un bloc de citation', ({ assert }) => {
    const c = comment({ comment: [{ type: 'tag', user: { id: ME } }, { text: ' regarde' }] })
    assert.isTrue(citesMe(c, ME, ME_NAME))
  })

  test('ne confond pas avec la citation de quelqu’un d’autre', ({ assert }) => {
    const c = comment({ comment: [{ type: 'tag', user: { id: 42 } }] })
    assert.isFalse(citesMe(c, ME, ME_NAME))
  })

  test('retombe sur le texte quand la citation n’est pas structurée', ({ assert }) => {
    assert.isTrue(citesMe(comment({ comment_text: 'cc @Sylvain merci' }), ME, ME_NAME))
    assert.isFalse(citesMe(comment({ comment_text: 'Sylvain a raison' }), ME, ME_NAME), 'sans @')
  })
})

test.group('findMentions', () => {
  test('retient une citation, ignore un commentaire quelconque', ({ assert }) => {
    const found = findMentions({
      tasks: [task('A'), task('B')],
      comments: {
        A: [comment({ comment: [{ type: 'tag', user: { id: ME } }], comment_text: 'à toi' })],
        B: [comment()],
      },
      config: clickUpDailyConfig.mentions,
      meUserId: ME,
      meName: ME_NAME,
      zone: ZONE,
      now: NOW,
    })

    assert.lengthOf(found, 1)
    assert.equal(found[0].task.id, 'A')
    assert.equal(found[0].mention.author, 'Alice')
    assert.isFalse(found[0].mention.assigned)
  })

  test('mon propre commentaire ne compte pas, sauf s’il m’est assigné', ({ assert }) => {
    const base = {
      tasks: [task('A')],
      config: clickUpDailyConfig.mentions,
      meUserId: ME,
      meName: ME_NAME,
      zone: ZONE,
      now: NOW,
    }

    const mine = comment({
      user: { id: ME, username: ME_NAME },
      comment_text: 'note pour moi @Sylvain',
    })
    assert.isEmpty(findMentions({ ...base, comments: { A: [mine] } }))
    assert.lengthOf(
      findMentions({ ...base, comments: { A: [{ ...mine, assignee: { id: ME } }] } }),
      1
    )
  })

  test('ignore ce qui est plus vieux que la fenêtre', ({ assert }) => {
    const vieux = comment({
      date: NOW.minus({ days: clickUpDailyConfig.mentions.lookbackDays + 1 }).toMillis(),
      comment: [{ type: 'tag', user: { id: ME } }],
    })

    assert.isEmpty(
      findMentions({
        tasks: [task('A')],
        comments: { A: [vieux] },
        config: clickUpDailyConfig.mentions,
        meUserId: ME,
        meName: ME_NAME,
        zone: ZONE,
        now: NOW,
      })
    )
  })

  test('trie le non résolu d’abord, puis du plus récent au plus ancien', ({ assert }) => {
    const cite = (id: string, days: number, resolved = false) =>
      comment({
        id,
        date: NOW.minus({ days }).toMillis(),
        resolved,
        comment: [{ type: 'tag', user: { id: ME } }],
      })

    const found = findMentions({
      tasks: [task('A')],
      comments: { A: [cite('vieux', 5), cite('resolu', 1, true), cite('recent', 2)] },
      config: clickUpDailyConfig.mentions,
      meUserId: ME,
      meName: ME_NAME,
      zone: ZONE,
      now: NOW,
    })

    assert.deepEqual(
      found.map((f) => f.mention.resolved),
      [false, false, true]
    )
    assert.isAbove(found[0].mention.when!.toMillis(), found[1].mention.when!.toMillis())
  })

  test('marque comme nouveau ce qui suit le rapport précédent', ({ assert }) => {
    const cite = (days: number) =>
      comment({
        date: NOW.minus({ days }).toMillis(),
        comment: [{ type: 'tag', user: { id: ME } }],
      })

    const found = findMentions({
      tasks: [task('A')],
      comments: { A: [cite(3), cite(0)] },
      config: clickUpDailyConfig.mentions,
      meUserId: ME,
      meName: ME_NAME,
      zone: ZONE,
      now: NOW,
      since: NOW.minus({ days: 1 }),
    })

    assert.deepEqual(
      found.map((f) => f.mention.isNew),
      [true, false]
    )
  })
})

test.group('cibles de balayage', () => {
  test('displayTargets met mes tâches devant et plafonne', ({ assert }) => {
    const tasks = [
      task('autre', { column: 'revue_a_faire' }),
      task('mienne', { isMine: true }),
      task('hors', { column: 'nouveau' }),
    ]
    const targets = displayTargets(tasks, clickUpDailyConfig.enrich)

    assert.deepEqual(
      targets.map((t) => t.id),
      ['mienne', 'autre']
    )
  })

  test('displayTargets ne rend rien si les commentaires sont coupés', ({ assert }) => {
    assert.isEmpty(
      displayTargets([task('A', { isMine: true })], {
        ...clickUpDailyConfig.enrich,
        comments: false,
      })
    )
  })

  test('mentionTargets prend les plus récemment modifiées, hors déjà lues', ({ assert }) => {
    const tasks = [
      task('deja', { staleDays: 0, updated: NOW }),
      task('recent', { staleDays: 1, updated: NOW.minus({ days: 1 }) }),
      task('vieux', { staleDays: 99, updated: NOW.minus({ days: 99 }) }),
      task('moyen', { staleDays: 3, updated: NOW.minus({ days: 3 }) }),
    ]

    const targets = mentionTargets(tasks, clickUpDailyConfig.mentions, new Set(['deja']))

    assert.deepEqual(
      targets.map((t) => t.id),
      ['recent', 'moyen'],
      'vieux dépasse la fenêtre'
    )
  })

  test('mentionTargets respecte le budget', ({ assert }) => {
    const tasks = Array.from({ length: 10 }, (_, i) =>
      task(`T${i}`, { staleDays: 1, updated: NOW })
    )
    const targets = mentionTargets(
      tasks,
      { ...clickUpDailyConfig.mentions, scanMaxTasks: 3 },
      new Set()
    )

    assert.lengthOf(targets, 3)
  })
})
