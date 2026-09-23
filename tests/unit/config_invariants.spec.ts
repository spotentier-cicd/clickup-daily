import { test } from '@japa/runner'
import clickUpDailyConfig from '#config/clickup_daily'
import { checkConfigInvariants } from '#domain/config/invariants'
import type { ClickUpDailyConfig } from '#domain/config/types'

/**
 * Part d'une copie de la configuration réelle et n'en casse qu'un point à la
 * fois : chaque test dit donc exactement quelle erreur est attrapée.
 */
function withConfig(mutate: (config: ClickUpDailyConfig) => void): ClickUpDailyConfig {
  const copy = structuredClone(clickUpDailyConfig) as ClickUpDailyConfig
  mutate(copy)
  return copy
}

test.group('Invariants de configuration', () => {
  test('la configuration livrée est cohérente', ({ assert }) => {
    assert.deepEqual(checkConfigInvariants(clickUpDailyConfig), [])
  })

  test('un statut sans colonne est signalé', ({ assert }) => {
    const config = withConfig((c) => {
      c.environments[0].statuses.push('dev terminé')
    })

    const problems = checkConfigInvariants(config)
    assert.lengthOf(problems, 1)
    assert.include(problems[0], 'dev terminé')
    assert.include(problems[0], 'aucune colonne')
  })

  test('un statut repris par deux colonnes est signalé', ({ assert }) => {
    const config = withConfig((c) => {
      c.columns[1].match.push(c.environments[0].statuses[0])
    })

    const problems = checkConfigInvariants(config)
    assert.isAbove(problems.length, 0)
    assert.isTrue(problems.some((p) => p.includes('ambigu')))
  })

  test('la comparaison des statuts ignore accents et casse', ({ assert }) => {
    const config = withConfig((c) => {
      c.environments[0].statuses = c.environments[0].statuses.map((s) => s.toUpperCase())
      c.environments[1].statuses = c.environments[1].statuses.map((s) => s.toUpperCase())
      c.environments[2].statuses = c.environments[2].statuses.map((s) => s.toUpperCase())
    })

    assert.deepEqual(checkConfigInvariants(config), [])
  })

  test('une colonne qui ne correspond à rien est signalée', ({ assert }) => {
    const config = withConfig((c) => {
      c.columns.push({
        key: 'fantome',
        label: 'Fantôme',
        match: ['statut inexistant'],
        color: '#000',
      })
    })

    const problems = checkConfigInvariants(config)
    assert.lengthOf(problems, 1)
    assert.include(problems[0], 'fantome')
    assert.include(problems[0], 'toujours vide')
  })

  test('une source de veille dans un groupe inexistant est signalée', ({ assert }) => {
    const config = withConfig((c) => {
      c.veille.sources[0].group = 'groupe_inexistant'
    })

    const problems = checkConfigInvariants(config)
    assert.lengthOf(problems, 1)
    assert.include(problems[0], 'groupe_inexistant')
  })

  test('les clés dupliquées sont signalées', ({ assert }) => {
    const config = withConfig((c) => {
      c.environments.push({ ...c.environments[0] })
    })

    const problems = checkConfigInvariants(config)
    assert.isTrue(problems.some((p) => p.includes('deux fois')))
  })

  test('un jour de semaine hors bornes est signalé', ({ assert }) => {
    const config = withConfig((c) => {
      c.temps.weekDays = [0, 1, 9]
    })

    const problems = checkConfigInvariants(config)
    assert.lengthOf(problems, 1)
    assert.include(problems[0], '9')
  })

  test('une borne numérique nulle est signalée', ({ assert }) => {
    const config = withConfig((c) => {
      c.mentions.scanMaxTasks = 0
    })

    const problems = checkConfigInvariants(config)
    assert.lengthOf(problems, 1)
    assert.include(problems[0], 'mentions.scanMaxTasks')
  })
})
