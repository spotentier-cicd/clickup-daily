import { test } from '@japa/runner'
import { refsIn } from '#domain/task/ref'

test.group('Références de tickets', () => {
  test('une branche nommée d’après un ticket le cite', ({ assert }) => {
    assert.deepEqual(refsIn('feature/ROC-1801-refonte'), ['roc-1801'])
  })

  test('la casse ne compte pas, et rien n’est cité deux fois', ({ assert }) => {
    assert.deepEqual(refsIn('ROC-12 puis roc-12 encore Roc-12'), ['roc-12'])
  })

  test('ROC-180 ne capture pas ROC-1801', ({ assert }) => {
    assert.deepEqual(refsIn('ROC-1801'), ['roc-1801'])
    assert.notInclude(refsIn('ROC-1801'), 'roc-180')
  })

  test('un lien ClickUp vaut citation', ({ assert }) => {
    assert.deepEqual(refsIn('voir https://app.clickup.com/t/9015220362/ROCND-701'), ['rocnd-701'])
  })

  test('un lien vers un identifiant interne ne donne pas de référence', ({ assert }) => {
    /* 86c1aaaa1 n'est pas une référence : ce ticket se rattache par identifiant. */
    assert.isEmpty(refsIn('https://app.clickup.com/t/86c1aaaa1'))
  })

  test('plusieurs tickets dans la même phrase ressortent tous', ({ assert }) => {
    assert.deepEqual(refsIn('ROC-1 et ROCND-2').sort(), ['roc-1', 'rocnd-2'])
  })

  test('un texte vide ne coûte rien', ({ assert }) => {
    assert.isEmpty(refsIn(''))
  })

  test('la regex est globale : deux appels de suite donnent le même résultat', ({ assert }) => {
    /* Une expression /g garde un curseur ; l'oublier fait sauter une citation sur deux. */
    assert.deepEqual(refsIn('ROC-7'), refsIn('ROC-7'))
  })
})
