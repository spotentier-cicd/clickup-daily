import { test } from '@japa/runner'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

/*
| app/domain est partagé avec le navigateur (alias Vite + exemption ESLint).
| Cette garantie ne tient que si le dossier reste pur : un import d'AdonisJS,
| de Lucid, de node: ou du reste de l'application y ferait entrer du code
| serveur dans le bundle client — ou casserait le build sans dire pourquoi.
*/

const DOMAIN = new URL('../../app/domain', import.meta.url).pathname

/** Seul luxon est toléré : c'est une bibliothèque de calcul, sans I/O. */
const INTERDITS = [
  { motif: /from '@adonisjs\//, raison: 'AdonisJS' },
  { motif: /from 'node:/, raison: 'API Node' },
  { motif: /from '#models\//, raison: 'un modèle Lucid' },
  { motif: /from '#services\//, raison: 'un service' },
  { motif: /from '#clickup\//, raison: "le client de l'API" },
  { motif: /from '#config\//, raison: 'la configuration applicative' },
  { motif: /from '#start\//, raison: "le démarrage de l'application" },
]

async function filesOf(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) return filesOf(path)
      return entry.name.endsWith('.ts') ? [path] : []
    })
  )
  return files.flat()
}

test.group('Pureté du domaine', () => {
  test('aucun fichier de app/domain n’importe de code serveur', async ({ assert }) => {
    const files = await filesOf(DOMAIN)
    assert.isAbove(files.length, 10, 'le dossier du domaine doit bien avoir été parcouru')

    const fautes: string[] = []
    for (const file of files) {
      const source = await readFile(file, 'utf8')
      for (const { motif, raison } of INTERDITS) {
        if (motif.test(source))
          fautes.push(`${file.replace(DOMAIN, 'app/domain')} importe ${raison}`)
      }
    }

    assert.deepEqual(fautes, [])
  })
})
