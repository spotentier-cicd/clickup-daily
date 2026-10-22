import { test } from '@japa/runner'
import { KanbanRepository } from '#services/kanban_repository'
import KanbanCard from '#models/kanban_card'
import { sanitizeCardInput } from '#domain/kanban'
import type { KanbanCardInput } from '#domain/kanban'

function input(partial: Partial<KanbanCardInput>): KanbanCardInput {
  return sanitizeCardInput({ column: 'todo', ...partial })
}

/** Les rangs d'une colonne, dans l'ordre : c'est tout ce qu'on vérifie ici. */
async function ranks(repository: KanbanRepository, column: string) {
  const cards = await repository.all()
  return cards
    .filter((card) => card.column === column)
    .map((card) => [card.ref, card.position] as const)
}

test.group('KanbanRepository', (group) => {
  group.each.setup(async () => {
    await KanbanCard.query().delete()
  })

  test('pose les cartes au bas de leur colonne', async ({ assert }) => {
    const repository = new KanbanRepository()
    await repository.create(input({ ref: 'A' }))
    await repository.create(input({ ref: 'B' }))
    await repository.create(input({ column: 'doing', ref: 'C' }))

    assert.deepEqual(await ranks(repository, 'todo'), [
      ['A', 0],
      ['B', 1],
    ])
    assert.deepEqual(await ranks(repository, 'doing'), [['C', 0]])
  })

  test('enregistre le ticket, les deux branches et la note', async ({ assert }) => {
    const repository = new KanbanRepository()
    await repository.create(
      input({
        column: 'blocked',
        ref: 'ROC-1801',
        taskId: '86abc',
        title: 'Refonte du panier',
        url: 'https://app.clickup.com/t/86abc',
        branchFront: 'feature/ROC-1801-panier',
        branchBack: 'feature/ROC-1801-api',
        comment: 'attend le retour de la recette',
      })
    )

    const [card] = await repository.all()
    assert.deepInclude(card, {
      column: 'blocked',
      ref: 'ROC-1801',
      taskId: '86abc',
      title: 'Refonte du panier',
      url: 'https://app.clickup.com/t/86abc',
      branchFront: 'feature/ROC-1801-panier',
      branchBack: 'feature/ROC-1801-api',
      comment: 'attend le retour de la recette',
    })
  })

  test('un déplacement renumérote les deux colonnes', async ({ assert }) => {
    const repository = new KanbanRepository()
    const a = await repository.create(input({ ref: 'A' }))
    await repository.create(input({ ref: 'B' }))
    await repository.create(input({ ref: 'C' }))
    await repository.create(input({ column: 'doing', ref: 'D' }))

    assert.isTrue(await repository.move(a.id, 'doing', 0))

    assert.deepEqual(await ranks(repository, 'doing'), [
      ['A', 0],
      ['D', 1],
    ])
    assert.deepEqual(await ranks(repository, 'todo'), [
      ['B', 0],
      ['C', 1],
    ])
  })

  test('déplacer une carte disparue ne casse rien', async ({ assert }) => {
    const repository = new KanbanRepository()
    assert.isFalse(await repository.move(404, 'doing', 0))
  })

  test('changer de colonne depuis le formulaire repose la carte au bas', async ({ assert }) => {
    const repository = new KanbanRepository()
    const a = await repository.create(input({ ref: 'A' }))
    await repository.create(input({ ref: 'B' }))
    await repository.create(input({ column: 'blocked', ref: 'C' }))

    await repository.update(a.id, input({ column: 'blocked', ref: 'A', comment: 'bloquée' }))

    assert.deepEqual(await ranks(repository, 'blocked'), [
      ['C', 0],
      ['A', 1],
    ])
    assert.deepEqual(await ranks(repository, 'todo'), [['B', 0]])
  })

  test('une carte supprimée referme le trou', async ({ assert }) => {
    const repository = new KanbanRepository()
    await repository.create(input({ ref: 'A' }))
    const b = await repository.create(input({ ref: 'B' }))
    await repository.create(input({ ref: 'C' }))

    assert.isTrue(await repository.destroy(b.id))
    assert.isFalse(await repository.destroy(b.id))

    assert.deepEqual(await ranks(repository, 'todo'), [
      ['A', 0],
      ['C', 1],
    ])
  })

  test('une colonne illisible en base se relit en « à faire »', async ({ assert }) => {
    const repository = new KanbanRepository()
    await repository.create(input({ ref: 'A' }))
    await KanbanCard.query().update({ column_key: 'archivée' })

    const [card] = await repository.all()
    assert.equal(card.column, 'todo')
  })
})
