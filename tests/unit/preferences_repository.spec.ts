import { test } from '@japa/runner'
import { PreferencesRepository } from '#services/preferences_repository'
import Preference from '#models/preference'

test.group('PreferencesRepository', (group) => {
  group.each.setup(async () => {
    await Preference.query().delete()
  })

  test('rend des préférences vides quand rien n’est enregistré', async ({ assert }) => {
    const preferences = await new PreferencesRepository().projects()

    assert.deepEqual(preferences, {
      hiddenEnvironments: [],
      hiddenLists: [],
      environmentOrder: [],
      hiddenFields: [],
    })
  })

  test('enregistre puis relit', async ({ assert }) => {
    const repository = new PreferencesRepository()
    await repository.saveProjects({
      hiddenEnvironments: ['ROC'],
      hiddenLists: ['TEMPO::Tempo Bug Tracking'],
      environmentOrder: ['TEMPO', 'ROCND'],
      hiddenFields: ['Requester'],
    })

    assert.deepEqual(await repository.projects(), {
      hiddenEnvironments: ['ROC'],
      hiddenLists: ['TEMPO::Tempo Bug Tracking'],
      environmentOrder: ['TEMPO', 'ROCND'],
      hiddenFields: ['Requester'],
    })
  })

  test('écrase au lieu d’empiler', async ({ assert }) => {
    const repository = new PreferencesRepository()
    const vide = { hiddenLists: [], environmentOrder: [], hiddenFields: [] }
    await repository.saveProjects({ hiddenEnvironments: ['ROC'], ...vide })
    await repository.saveProjects({ hiddenEnvironments: ['TEMPO'], ...vide })

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
      hiddenFields: [],
    })
  })

  test('une valeur illisible en base n’empêche pas l’ouverture', async ({ assert }) => {
    await Preference.create({ key: 'projects', value: '{ ceci n est pas du json' })

    assert.deepEqual(await new PreferencesRepository().projects(), {
      hiddenEnvironments: [],
      hiddenLists: [],
      environmentOrder: [],
      hiddenFields: [],
    })
  })
})

test.group('PreferencesRepository — les interrupteurs', (group) => {
  group.each.setup(async () => {
    await Preference.query().delete()
  })

  test('tout est éteint tant que rien n’a été coché', async ({ assert }) => {
    assert.deepEqual(await new PreferencesRepository().options(), { claude: false })
  })

  test('allumer puis éteindre se relit', async ({ assert }) => {
    const repository = new PreferencesRepository()

    await repository.saveOptions({ claude: true })
    assert.deepEqual(await repository.options(), { claude: true })

    await repository.saveOptions({ claude: false })
    assert.deepEqual(await repository.options(), { claude: false })
  })

  test('un enregistrement d’avant l’option la trouve éteinte', async ({ assert }) => {
    /* Sinon l'ajout d'un interrupteur lancerait une collecte que personne n'a demandée. */
    await Preference.create({ key: 'options', value: '{}' })

    assert.deepEqual(await new PreferencesRepository().options(), { claude: false })
  })

  test('une valeur illisible n’empêche pas l’ouverture', async ({ assert }) => {
    await Preference.create({ key: 'options', value: 'pas du json' })

    assert.deepEqual(await new PreferencesRepository().options(), { claude: false })
  })

  test('seul un vrai explicite allume', async ({ assert }) => {
    await Preference.create({ key: 'options', value: JSON.stringify({ claude: 'oui' }) })

    assert.deepEqual(await new PreferencesRepository().options(), { claude: false })
  })
})
