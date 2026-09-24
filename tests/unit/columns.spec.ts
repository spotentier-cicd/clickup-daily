import { test } from '@japa/runner'
import clickUpDailyConfig from '#config/clickup_daily'
import { buildColumns, columnFor, OTHER_COLUMN, proposeColumn } from '#domain/task/columns'

const COLUMNS = buildColumns(clickUpDailyConfig.columns)
const proposed = (status: string) => proposeColumn(status, COLUMNS)?.key ?? null

test.group('Colonnes — proposition sur un workspace inconnu', () => {
  test('reconnaît un workflow français', ({ assert }) => {
    assert.equal(proposed('nouveau'), 'nouveau')
    assert.equal(proposed('a faire'), 'a_faire')
    assert.equal(proposed('dev en cours'), 'dev_en_cours')
    assert.equal(proposed('revue de code a faire'), 'revue_a_faire')
    assert.equal(proposed('deployé sur recette'), 'recette')
  })

  test('reconnaît un workflow anglais', ({ assert }) => {
    assert.equal(proposed('To Do'), 'a_faire')
    assert.equal(proposed('In Progress'), 'dev_en_cours')
    assert.equal(proposed('In Review'), 'revue_a_faire')
    assert.equal(proposed('Staging'), 'recette')
  })

  test('le fragment le plus long l’emporte', ({ assert }) => {
    /* « revue de code ok » contient « revue » et « revue de code ok ». */
    assert.equal(proposed('revue de code ok'), 'revue_ok')
    assert.equal(proposed('revue ok'), 'revue_ok')
    assert.equal(proposed('Reviewed'), 'revue_ok')
  })

  test('ignore accents et casse', ({ assert }) => {
    assert.equal(proposed('À FAIRE'), 'a_faire')
    assert.equal(proposed('Déployé Sur Recette'), 'recette')
  })

  test('ne propose rien pour un état hors workflow', ({ assert }) => {
    for (const status of ['production', 'cloturé', 'pause', 'annulé', 'Closed']) {
      assert.isNull(proposed(status), `${status} ne devrait rien attraper`)
    }
  })
})

test.group('Colonnes — le choix explicite l’emporte', () => {
  test('sans choix, la proposition s’applique', ({ assert }) => {
    assert.equal(columnFor('In Progress', COLUMNS).key, 'dev_en_cours')
  })

  test('un rattachement explicite gagne contre la proposition', ({ assert }) => {
    const column = columnFor('In Progress', COLUMNS, { 'in progress': 'recette' })
    assert.equal(column.key, 'recette')
  })

  test('une chaîne vide range volontairement dans « Autres »', ({ assert }) => {
    const column = columnFor('In Progress', COLUMNS, { 'in progress': '' })
    assert.equal(column.key, OTHER_COLUMN)
  })

  test('un statut inconnu de tous atterrit dans « Autres »', ({ assert }) => {
    const column = columnFor('Bloqué par le client', COLUMNS)
    assert.equal(column.key, OTHER_COLUMN)
    assert.equal(column.label, 'Autres')
  })

  test('un rattachement vers une colonne disparue retombe sur « Autres »', ({ assert }) => {
    const column = columnFor('nouveau', COLUMNS, { nouveau: 'colonne_supprimee' })
    assert.equal(column.key, OTHER_COLUMN)
  })

  test('« Autres » est toujours la dernière colonne', ({ assert }) => {
    const last = COLUMNS.at(-1)!
    assert.equal(last.key, OTHER_COLUMN)
    assert.equal(last.order, COLUMNS.length - 1)
  })
})
