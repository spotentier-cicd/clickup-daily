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

  test('une colonne sans indice est signalée', ({ assert }) => {
    const config = withConfig((c) => {
      c.columns[0].hints = []
    })

    const problems = checkConfigInvariants(config)
    assert.lengthOf(problems, 1)
    assert.include(problems[0], 'aucun indice')
  })

  test('la clé réservée « autres » est signalée', ({ assert }) => {
    const config = withConfig((c) => {
      c.columns.push({ key: 'autres', label: 'Autres', hints: ['x'], color: '#000' })
    })

    const problems = checkConfigInvariants(config)
    assert.lengthOf(problems, 1)
    assert.include(problems[0], 'réservée')
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
      c.columns.push({ ...c.columns[0] })
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
