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
    for (const status of ['cloturé', 'annulé', 'Closed', 'archivé', 'Bloqué par le client']) {
      assert.isNull(proposed(status), `${status} ne devrait rien attraper`)
    }
  })
})

/*
| Les statuts d'un workspace réel, tels que ClickUp les remonte. Chacun doit
| trouver son étape : un statut rangé dans « Autres » n'entre dans aucune
| règle, et c'est précisément ce qu'on ne veut pas pour un état du workflow.
*/
test.group('Colonnes — chaque statut du workspace trouve son étape', () => {
  test('les attentes se distinguent : direction/PO avant le dev, client après la recette', ({
    assert,
  }) => {
    assert.equal(proposed('en attente direction/po'), 'attente_po')
    assert.equal(proposed('en attente  retour client'), 'attente_client')
    assert.equal(proposed('à tester par client'), 'recette')
  })

  test('une pause a son étape', ({ assert }) => {
    assert.equal(proposed('pause'), 'pause')
    assert.equal(proposed('On Hold'), 'pause')
  })

  test('un rejet, de revue ou de tests, revient à corriger', ({ assert }) => {
    /* « revue rejetée » contient « revue » : c'est le fragment le plus long qui parle. */
    assert.equal(proposed('revue rejetée'), 'a_corriger')
    assert.equal(proposed('tests cicd rejetés'), 'a_corriger')
    assert.equal(proposed('tests client rejetés'), 'a_corriger')
    assert.equal(proposed('rejeté cicd'), 'a_corriger')
    assert.equal(proposed('Changes requested'), 'a_corriger')
  })

  test('la validation client et la production sont des étapes', ({ assert }) => {
    assert.equal(proposed('tests client validé'), 'valide_client')
    assert.equal(proposed('production'), 'production')
    assert.equal(proposed('Released'), 'production')
  })

  test('« à valider » reste une recette, « préprod » aussi', ({ assert }) => {
    assert.equal(proposed('à valider'), 'recette')
    assert.equal(proposed('pre-prod'), 'recette')
    assert.equal(proposed('preprod'), 'recette')
  })

  test('les tests internes restent en recette', ({ assert }) => {
    assert.equal(proposed('à tester formateur cicd'), 'recette')
    assert.equal(proposed('deployé sur recette'), 'recette')
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
