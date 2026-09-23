import { test } from '@japa/runner'
import { findHighlights, normalize } from '#domain/text'

test.group('normalize', () => {
  test('retire accents, casse et espaces superflus', ({ assert }) => {
    assert.equal(normalize('  Deployé   SUR  Recette '), 'deploye sur recette')
    assert.equal(normalize('Revue de code à faire'), 'revue de code a faire')
  })

  test('tolère null et undefined', ({ assert }) => {
    assert.equal(normalize(null), '')
    assert.equal(normalize(undefined), '')
    assert.equal(normalize(''), '')
  })
})

test.group('findHighlights', () => {
  test('ne remonte que les mots entiers', ({ assert }) => {
    assert.deepEqual(findHighlights('Express 5 released', ['Express']), ['Express'])
    assert.deepEqual(findHighlights('He expressed doubts', ['Express']), [])
    assert.deepEqual(findHighlights('Send an invite', ['Vite']), [])
  })

  test('un astérisque final autorise un suffixe', ({ assert }) => {
    assert.deepEqual(findHighlights('Laravel 14 is out', ['Laravel 1*']), ['Laravel 14'])
    assert.deepEqual(findHighlights('This API is deprecated', ['deprecat*']), ['deprecated'])
  })

  test('le suffixe accepte les points de version', ({ assert }) => {
    assert.deepEqual(findHighlights('PHP 8.4 released', ['PHP 8*']), ['PHP 8.4'])
  })

  test('cherche aussi sans tenir compte des accents', ({ assert }) => {
    assert.deepEqual(findHighlights('Faille de sécurité critique', ['sécurité']), ['sécurité'])
  })

  test('renvoie chaque mot-clé trouvé, et rien sinon', ({ assert }) => {
    assert.deepEqual(findHighlights('Vue 3 et Vite', ['Vue 3*', 'Vite', 'MySQL']), [
      'Vue 3',
      'Vite',
    ])
    assert.deepEqual(findHighlights('Rien à voir', ['Laravel']), [])
  })
})
