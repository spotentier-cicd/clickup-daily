import { test } from '@japa/runner'
import {
  branchFor,
  cardsOfColumn,
  isCardEmpty,
  moveCard,
  nextPosition,
  sanitizeCardInput,
  sortCards,
  toKanbanColumn,
} from '#domain/kanban'
import type { KanbanColumnKey } from '#domain/kanban'

/** Le strict nécessaire pour ranger : identifiant, colonne, rang. */
function card(id: number, column: KanbanColumnKey, position: number) {
  return { id, column, position }
}

test.group('Tableau personnel — rangement', () => {
  test('range par colonne du workflow, puis par rang', ({ assert }) => {
    const sorted = sortCards([
      card(1, 'blocked', 0),
      card(2, 'todo', 1),
      card(3, 'doing', 0),
      card(4, 'todo', 0),
    ])

    assert.deepEqual(
      sorted.map((entry) => entry.id),
      [4, 2, 3, 1]
    )
  })

  test('une carte changée de colonne renumérote les deux', ({ assert }) => {
    const cards = [card(1, 'todo', 0), card(2, 'todo', 1), card(3, 'todo', 2), card(4, 'doing', 0)]

    const moved = moveCard(cards, 1, 'doing', 0)

    assert.deepEqual(
      cardsOfColumn(moved, 'doing').map((entry) => [entry.id, entry.position]),
      [
        [1, 0],
        [4, 1],
      ]
    )
    /* La colonne quittée ne garde pas le trou laissé par la carte partie. */
    assert.deepEqual(
      cardsOfColumn(moved, 'todo').map((entry) => [entry.id, entry.position]),
      [
        [2, 0],
        [3, 1],
      ]
    )
  })

  test('remonter une carte dans sa propre colonne', ({ assert }) => {
    const cards = [card(1, 'todo', 0), card(2, 'todo', 1), card(3, 'todo', 2)]

    assert.deepEqual(
      cardsOfColumn(moveCard(cards, 3, 'todo', 0), 'todo').map((entry) => entry.id),
      [3, 1, 2]
    )
  })

  test('un rang hors bornes tombe à la fin', ({ assert }) => {
    const cards = [card(1, 'todo', 0), card(2, 'doing', 0), card(3, 'doing', 1)]

    assert.deepEqual(
      cardsOfColumn(moveCard(cards, 1, 'doing', 99), 'doing').map((entry) => entry.id),
      [2, 3, 1]
    )
    assert.deepEqual(
      cardsOfColumn(moveCard(cards, 1, 'doing', -5), 'doing').map((entry) => entry.id),
      [1, 2, 3]
    )
  })

  test('une carte inconnue ne dérange rien', ({ assert }) => {
    const cards = [card(1, 'todo', 0), card(2, 'doing', 0)]

    assert.deepEqual(moveCard(cards, 404, 'blocked', 0), sortCards(cards))
  })

  test('une carte nouvelle se pose au bas de sa colonne', ({ assert }) => {
    const cards = [card(1, 'todo', 0), card(2, 'todo', 1), card(3, 'doing', 0)]

    assert.equal(nextPosition(cards, 'todo'), 2)
    assert.equal(nextPosition(cards, 'blocked'), 0)
  })
})

test.group('Tableau personnel — ce qui entre en base', () => {
  test('rogne les blancs et plafonne les longueurs', ({ assert }) => {
    const input = sanitizeCardInput({
      column: 'doing',
      ref: '  ROC-1801  ',
      title: 'x'.repeat(500),
      comment: '  à reprendre lundi  ',
    })

    assert.equal(input.ref, 'ROC-1801')
    assert.equal(input.title.length, 200)
    assert.equal(input.comment, 'à reprendre lundi')
    assert.equal(input.column, 'doing')
  })

  test('une colonne inconnue retombe en « à faire »', ({ assert }) => {
    assert.equal(sanitizeCardInput({ column: 'terminé' }).column, 'todo')
    assert.equal(toKanbanColumn(undefined), 'todo')
    assert.equal(toKanbanColumn('blocked'), 'blocked')
  })

  test('seul un lien http tient lieu de lien', ({ assert }) => {
    assert.equal(
      sanitizeCardInput({ url: 'https://app.clickup.com/t/abc' }).url,
      'https://app.clickup.com/t/abc'
    )
    assert.equal(sanitizeCardInput({ url: 'javascript:alert(1)' }).url, '')
    assert.equal(sanitizeCardInput({ url: 'app.clickup.com/t/abc' }).url, '')
  })

  test('ce qui n’est pas une chaîne devient une chaîne vide', ({ assert }) => {
    const input = sanitizeCardInput({ ref: 42, title: null, comment: { texte: 'non' } })

    assert.deepEqual([input.ref, input.title, input.comment], ['', '', ''])
  })

  test('une carte demande au moins un ticket ou un intitulé', ({ assert }) => {
    assert.isTrue(isCardEmpty(sanitizeCardInput({ column: 'todo', comment: 'juste une note' })))
    assert.isFalse(isCardEmpty(sanitizeCardInput({ column: 'todo', ref: 'ROC-1' })))
    assert.isFalse(isCardEmpty(sanitizeCardInput({ column: 'todo', title: 'Relancer l’infra' })))
  })

  test('la branche porte le nom du ticket, et rien sans ticket', ({ assert }) => {
    assert.equal(branchFor('ROCND-1311'), 'feature/ROCND-1311')
    assert.equal(branchFor('  ROCND-1311  '), 'feature/ROCND-1311')
    assert.equal(branchFor(''), '')
    assert.equal(branchFor('   '), '')
  })
})
