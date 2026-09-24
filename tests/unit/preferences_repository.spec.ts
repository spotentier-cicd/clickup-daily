import { test } from '@japa/runner'
import { PreferencesRepository } from '#services/preferences_repository'
import Preference from '#models/preference'

test.group('PreferencesRepository', (group) => {
  group.each.setup(async () => {
    await Preference.query().delete()
  })

  test('rend des préférences vides quand rien n’est enregistré', async ({ assert }) => {
    const preferences = await new PreferencesRepository().projects()

    assert.deepEqual(preferences, { hiddenEnvironments: [], hiddenLists: [], environmentOrder: [] })
  })

  test('enregistre puis relit', async ({ assert }) => {
    const repository = new PreferencesRepository()
    await repository.saveProjects({
      hiddenEnvironments: ['ROC'],
      hiddenLists: ['TEMPO::Tempo Bug Tracking'],
      environmentOrder: ['TEMPO', 'ROCND'],
    })

    assert.deepEqual(await repository.projects(), {
      hiddenEnvironments: ['ROC'],
      hiddenLists: ['TEMPO::Tempo Bug Tracking'],
      environmentOrder: ['TEMPO', 'ROCND'],
    })
  })

  test('écrase au lieu d’empiler', async ({ assert }) => {
    const repository = new PreferencesRepository()
    await repository.saveProjects({
      hiddenEnvironments: ['ROC'],
      hiddenLists: [],
      environmentOrder: [],
    })
    await repository.saveProjects({
      hiddenEnvironments: ['TEMPO'],
      hiddenLists: [],
      environmentOrder: [],
    })

    const preferences = await repository.projects()
    assert.deepEqual(preferences.hiddenEnvironments, ['TEMPO'])
    assert.equal(
      await Preference.query()
        .count('* as total')
        .then((r) => Number(r[0].$extras.total)),
      1
    )
  })

  test('nettoie ce qui n’est pas une liste de chaînes', async ({ assert }) => {
    const repository = new PreferencesRepository()
    const saved = await repository.saveProjects({
      hiddenEnvironments: ['ROC', 'ROC', 42, null, 'TEMPO'],
      hiddenLists: 'pas un tableau',
      environmentOrder: undefined,
    } as never)

    assert.deepEqual(saved, {
      hiddenEnvironments: ['ROC', 'TEMPO'],
      hiddenLists: [],
      environmentOrder: [],
    })
  })

  test('une valeur illisible en base n’empêche pas l’ouverture', async ({ assert }) => {
    await Preference.create({ key: 'projects', value: '{ ceci n est pas du json' })

    assert.deepEqual(await new PreferencesRepository().projects(), {
      hiddenEnvironments: [],
      hiddenLists: [],
      environmentOrder: [],
    })
  })
})
