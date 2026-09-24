import { test } from '@japa/runner'
import { costOf, isBillable, normalizeModel, priceOf } from '#domain/claude/pricing'
import type { TokenUsage } from '#domain/claude/pricing'

function usage(partial: Partial<TokenUsage>): TokenUsage {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite5m: 0,
    cacheWrite1h: 0,
    webSearches: 0,
    ...partial,
  }
}

test.group('Tarification — les identifiants', () => {
  test('la fenêtre de contexte ne change pas le tarif', ({ assert }) => {
    assert.equal(normalizeModel('claude-opus-5[1m]'), 'claude-opus-5')
    assert.deepEqual(priceOf('claude-opus-5[1m]'), priceOf('claude-opus-5'))
  })

  test('la date de version tombe', ({ assert }) => {
    assert.equal(normalizeModel('claude-haiku-4-5-20251001'), 'claude-haiku-4-5')
    assert.isNotNull(priceOf('claude-haiku-4-5-20251001'))
  })

  test('un modèle absent de la grille se signale au lieu de valoir zéro', ({ assert }) => {
    assert.isNull(priceOf('claude-inconnu-9'))
    assert.isNull(costOf(usage({ output: 1_000_000 }), 'claude-inconnu-9'))
  })

  test('les messages fabriqués par le client ne sont pas facturables', ({ assert }) => {
    assert.isFalse(isBillable('<synthetic>'))
    assert.isTrue(isBillable('claude-opus-5'))
  })
})

test.group('Tarification — les montants', () => {
  /*
   * Les deux cas suivants viennent de conversations réelles : les compteurs
   * sont ceux que Claude Code a inscrits, et le montant attendu est celui
   * qu'il a lui-même facturé. C'est l'étalon de la grille, figé ici pour que
   * la commande claude:usage --verify ne soit pas seule à le tenir.
   */
  test('Fable 5.1 retombe au centième sur un relevé réel', ({ assert }) => {
    const cost = costOf(
      usage({ input: 418, output: 30_183, cacheRead: 1_035_354, cacheWrite1h: 99_292 }),
      'claude-fable-5-1'
    )

    assert.closeTo(cost!, 3.7580085, 1e-7)
  })

  test('Opus 5 retombe au centième sur un relevé réel', ({ assert }) => {
    const cost = costOf(
      usage({ input: 612, output: 91_502, cacheRead: 19_528_206, cacheWrite1h: 411_472 }),
      'claude-opus-5[1m]'
    )

    assert.closeTo(cost!, 16.169433, 1e-6)
  })

  test('les deux durées de cache ne se paient pas au même prix', ({ assert }) => {
    /* Sonnet 5 : 2,50 $ le million en cache court, 4 $ en cache long. */
    const court = costOf(usage({ cacheWrite5m: 1_000_000 }), 'claude-sonnet-5')
    const long = costOf(usage({ cacheWrite1h: 1_000_000 }), 'claude-sonnet-5')

    assert.closeTo(court!, 2.5, 1e-9)
    assert.closeTo(long!, 4, 1e-9)
  })

  test('une lecture de cache coûte une fraction de l’entrée', ({ assert }) => {
    assert.closeTo(costOf(usage({ cacheRead: 1_000_000 }), 'claude-sonnet-5')!, 0.2, 1e-9)
    assert.closeTo(costOf(usage({ cacheRead: 1_000_000 }), 'claude-fable-5-1')!, 0.25, 1e-9)
  })

  test('le mode rapide se paie plus cher', ({ assert }) => {
    const normal = costOf(usage({ output: 1_000_000 }), 'claude-opus-5')
    const rapide = costOf(usage({ output: 1_000_000 }), 'claude-opus-5', 'fast')

    assert.closeTo(normal!, 25, 1e-9)
    assert.closeTo(rapide!, 50, 1e-9)
  })

  test('une recherche web s’ajoute aux tokens', ({ assert }) => {
    assert.closeTo(costOf(usage({ webSearches: 1000 }), 'claude-sonnet-5')!, 10, 1e-9)
  })
})
