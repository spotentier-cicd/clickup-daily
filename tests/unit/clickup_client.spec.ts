import { test } from '@japa/runner'
import { ClickUpClient } from '#clickup/client'
import type { RawTask } from '#domain/task/types'

/*
| Le client n'appelle jamais l'API dans les tests : on remplace `get` par des
| pages en mémoire, et on regarde ce que la pagination demande.
*/
class PagedClient extends ClickUpClient {
  asked: number[] = []

  constructor(private readonly pages: RawTask[][]) {
    super({ token: 'factice' })
  }

  async get<T>(_path: string, params?: Record<string, unknown>): Promise<T> {
    const page = Number(params?.page ?? 0)
    this.asked.push(page)
    return { tasks: this.pages[page] ?? [], last_page: page >= this.pages.length - 1 } as T
  }
}

const page = (prefix: string, size: number): RawTask[] =>
  Array.from({ length: size }, (_, i) => ({ id: `${prefix}-${i}` }))

test.group('ClickUpClient — pagination des tâches', () => {
  test('la première salve part par trois, même pour une seule page', async ({ assert }) => {
    const client = new PagedClient([page('a', 40)])

    const tasks = await client.teamTasks('team', ['L1'], ['nouveau'])

    assert.lengthOf(tasks, 40)
    assert.deepEqual(client.asked, [0, 1, 2])
  })

  test('trois cents tâches tiennent dans une salve, dans l’ordre', async ({ assert }) => {
    const client = new PagedClient([page('a', 100), page('b', 100), page('c', 81)])

    const tasks = await client.teamTasks('team', ['L1'], ['nouveau'])

    assert.lengthOf(tasks, 281)
    assert.deepEqual(client.asked, [0, 1, 2])
    assert.equal(tasks[0].id, 'a-0')
    assert.equal(tasks[100].id, 'b-0')
    assert.equal(tasks[280].id, 'c-80')
  })

  test('au-delà, une salve de plus — et au pire deux pages vides pour rien', async ({ assert }) => {
    const client = new PagedClient([page('a', 100), page('b', 100), page('c', 100), page('d', 10)])

    const tasks = await client.teamTasks('team', ['L1'], ['nouveau'])

    assert.lengthOf(tasks, 310)
    assert.deepEqual(client.asked, [0, 1, 2, 3, 4, 5])
    assert.equal(tasks[309].id, 'd-9')
  })

  test('sans liste ou sans statut, aucun appel', async ({ assert }) => {
    const client = new PagedClient([page('a', 10)])

    assert.deepEqual(await client.teamTasks('team', [], ['nouveau']), [])
    assert.deepEqual(await client.teamTasks('team', ['L1'], []), [])
    assert.deepEqual(client.asked, [])
  })
})
