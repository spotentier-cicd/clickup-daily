import { test } from '@japa/runner'
import {
  buildProjectCatalog,
  countHidden,
  defaultPreferences,
  isTaskVisible,
  listKey,
  orderedEnvironments,
} from '#domain/projects'

const ENVIRONMENTS = [
  { key: 'ROC', label: 'ROC' },
  { key: 'ROCND', label: 'ROC New Deal' },
  { key: 'TEMPO', label: 'Tempo' },
]

function task(envKey: string, listName: string, extra: { isMine?: boolean; isBug?: boolean } = {}) {
  return { envKey, listName, isMine: false, isBug: false, ...extra } as never
}

const TASKS = [
  task('ROCND', 'ROC ND Evol', { isMine: true }),
  task('ROCND', 'ROC ND Evol'),
  task('ROCND', 'ROC ND bug maintenance', { isBug: true }),
  task('TEMPO', 'Tempo CICD Only', { isMine: true, isBug: true }),
  task('ROC', 'ROC Evol'),
]

test.group('buildProjectCatalog', () => {
  test('recense les espaces de la config et les listes des données', ({ assert }) => {
    const catalog = buildProjectCatalog(TASKS, ENVIRONMENTS)

    assert.deepEqual(
      catalog.environments.map((e) => [e.key, e.total]),
      [
        ['ROC', 1],
        ['ROCND', 3],
        ['TEMPO', 1],
      ]
    )

    const rocnd = catalog.environments.find((e) => e.key === 'ROCND')!
    assert.deepEqual(
      rocnd.lists.map((l) => [l.name, l.total]),
      [
        ['ROC ND Evol', 2],
        ['ROC ND bug maintenance', 1],
      ],
      'les listes les plus fournies d’abord'
    )
  })

  test('compte séparément mes tâches et les bugs', ({ assert }) => {
    const catalog = buildProjectCatalog(TASKS, ENVIRONMENTS)
    const tempo = catalog.environments.find((e) => e.key === 'TEMPO')!

    assert.equal(tempo.mine, 1)
    assert.equal(tempo.bugs, 1)
  })

  test('garde un espace configuré même sans tâche', ({ assert }) => {
    const catalog = buildProjectCatalog([], ENVIRONMENTS)

    assert.lengthOf(catalog.environments, 3)
    assert.isTrue(catalog.environments.every((e) => e.total === 0))
  })

  test('deux espaces peuvent porter une liste du même nom', ({ assert }) => {
    assert.notEqual(listKey('ROC', 'Evol'), listKey('ROCND', 'Evol'))
  })
})

test.group('isTaskVisible', () => {
  test('tout est visible par défaut', ({ assert }) => {
    const preferences = defaultPreferences()
    assert.isTrue(TASKS.every((t) => isTaskVisible(t, preferences)))
  })

  test('masquer un espace masque toutes ses tâches', ({ assert }) => {
    const preferences = { ...defaultPreferences(), hiddenEnvironments: ['ROCND'] }

    assert.equal(countHidden(TASKS, preferences), 3)
    assert.isFalse(isTaskVisible(TASKS[0], preferences))
    assert.isTrue(isTaskVisible(TASKS[3], preferences))
  })

  test('masquer une liste ne touche pas les autres listes de l’espace', ({ assert }) => {
    const preferences = { ...defaultPreferences(), hiddenLists: [listKey('ROCND', 'ROC ND Evol')] }

    assert.equal(countHidden(TASKS, preferences), 2)
    assert.isTrue(isTaskVisible(TASKS[2], preferences), 'l’autre liste de ROCND reste visible')
  })

  test('un espace inconnu des préférences reste visible', ({ assert }) => {
    const preferences = { ...defaultPreferences(), hiddenEnvironments: ['AUTRE'] }
    assert.equal(countHidden(TASKS, preferences), 0)
  })
})

test.group('orderedEnvironments', () => {
  test('suit l’ordre choisi', ({ assert }) => {
    const catalog = buildProjectCatalog(TASKS, ENVIRONMENTS)
    const ordered = orderedEnvironments(catalog, {
      ...defaultPreferences(),
      environmentOrder: ['TEMPO', 'ROC'],
    })

    assert.deepEqual(
      ordered.map((e) => e.key),
      ['TEMPO', 'ROC', 'ROCND'],
      'ceux qui ne sont pas classés suivent, dans l’ordre du catalogue'
    )
  })

  test('sans ordre choisi, garde celui de la configuration', ({ assert }) => {
    const catalog = buildProjectCatalog(TASKS, ENVIRONMENTS)
    const ordered = orderedEnvironments(catalog, defaultPreferences())

    assert.deepEqual(
      ordered.map((e) => e.key),
      ['ROC', 'ROCND', 'TEMPO']
    )
  })
})
