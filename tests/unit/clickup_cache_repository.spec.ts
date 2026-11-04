import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import ClickupCacheEntry from '#models/clickup_cache_entry'
import { ClickupCacheRepository } from '#services/clickup_cache_repository'

const ZONE = 'Europe/Paris'
const NOW = DateTime.fromISO('2026-11-04T09:00:00', { zone: ZONE })

test.group('ClickupCacheRepository — commentaires', (group) => {
  group.each.setup(async () => {
    await ClickupCacheEntry.query().delete()
  })

  test('rend ce qui a été mémorisé, tant que la tâche n’a pas bougé', async ({ assert }) => {
    const cache = new ClickupCacheRepository()
    await cache.rememberComments(
      [{ id: 'T1', stamp: '100', comments: [{ id: 'c1', comment_text: 'salut' }] }],
      NOW
    )

    const found = await cache.comments([{ id: 'T1', stamp: '100' }])

    assert.deepEqual(found.get('T1')?.comments, [{ id: 'c1', comment_text: 'salut' }])
    assert.equal(found.get('T1')?.fetchedAt.toFormat('yyyy-MM-dd HH:mm'), '2026-11-04 09:00')
  })

  test('une tâche qui a bougé ne reprend pas ses vieux commentaires', async ({ assert }) => {
    const cache = new ClickupCacheRepository()
    await cache.rememberComments([{ id: 'T1', stamp: '100', comments: [] }], NOW)

    const found = await cache.comments([{ id: 'T1', stamp: '101' }])

    assert.isFalse(found.has('T1'))
  })

  test('une tâche jamais lue est simplement absente', async ({ assert }) => {
    const found = await new ClickupCacheRepository().comments([{ id: 'T9', stamp: '1' }])
    assert.equal(found.size, 0)
  })

  test('relire remplace l’entrée, estampille comprise', async ({ assert }) => {
    const cache = new ClickupCacheRepository()
    await cache.rememberComments([{ id: 'T1', stamp: '100', comments: [{ id: 'c1' }] }], NOW)
    await cache.rememberComments(
      [{ id: 'T1', stamp: '200', comments: [{ id: 'c1' }, { id: 'c2' }] }],
      NOW.plus({ hours: 1 })
    )

    const stale = await cache.comments([{ id: 'T1', stamp: '100' }])
    const fresh = await cache.comments([{ id: 'T1', stamp: '200' }])

    assert.isFalse(stale.has('T1'))
    assert.lengthOf(fresh.get('T1')!.comments, 2)
    assert.lengthOf(await ClickupCacheEntry.all(), 1)
  })

  test('une entrée illisible vaut une entrée absente', async ({ assert }) => {
    await ClickupCacheEntry.create({
      key: 'comments:T1',
      stamp: '100',
      payload: '{pas du json',
      fetchedAt: NOW,
    })

    const found = await new ClickupCacheRepository().comments([{ id: 'T1', stamp: '100' }])

    assert.deepEqual(found.get('T1')?.comments, [])
  })
})

test.group('ClickupCacheRepository — statuts de sortie', (group) => {
  group.each.setup(async () => {
    await ClickupCacheEntry.query().delete()
  })

  test('rend le statut mémorisé avec sa date de lecture', async ({ assert }) => {
    const cache = new ClickupCacheRepository()
    await cache.rememberExitStatuses([{ id: 'T1', status: 'production' }], NOW)

    const found = await cache.exitStatuses(['T1', 'T2'])

    assert.equal(found.get('T1')?.status, 'production')
    assert.equal(found.get('T1')?.fetchedAt.toFormat('HH:mm'), '09:00')
    assert.isFalse(found.has('T2'))
  })

  test('les deux usages ne se marchent pas dessus', async ({ assert }) => {
    const cache = new ClickupCacheRepository()
    await cache.rememberComments([{ id: 'T1', stamp: '1', comments: [] }], NOW)
    await cache.rememberExitStatuses([{ id: 'T1', status: 'pause' }], NOW)

    const statuses = await cache.exitStatuses(['T1'])
    const comments = await cache.comments([{ id: 'T1', stamp: '1' }])

    assert.equal(statuses.get('T1')?.status, 'pause')
    assert.deepEqual(comments.get('T1')?.comments, [])
  })

  test('la purge oublie ce qui n’a pas été relu depuis la rétention', async ({ assert }) => {
    const cache = new ClickupCacheRepository()
    await cache.rememberExitStatuses([{ id: 'vieux', status: 'x' }], NOW.minus({ days: 40 }))
    await cache.rememberExitStatuses([{ id: 'recent', status: 'y' }], NOW.minus({ days: 2 }))

    await cache.purge(30, NOW)

    const found = await cache.exitStatuses(['vieux', 'recent'])
    assert.isFalse(found.has('vieux'))
    assert.isTrue(found.has('recent'))
  })
})
