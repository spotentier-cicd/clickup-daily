import Preference from '#models/preference'
import { defaultPreferences } from '#domain/projects'
import type { ProjectPreferences } from '#domain/projects'

const PROJECTS_KEY = 'projects'

/**
 * Les réglages d'affichage.
 *
 * Ils ne touchent pas à la collecte : un projet masqué est quand même ramené et
 * enregistré. C'est voulu — on peut le réafficher sans relancer d'appels, et
 * les archives restent complètes, donc honnêtes.
 */
export class PreferencesRepository {
  async projects(): Promise<ProjectPreferences> {
    const row = await Preference.findBy('key', PROJECTS_KEY)
    if (!row) return defaultPreferences()

    try {
      return sanitize(JSON.parse(row.value))
    } catch {
      /* Une valeur illisible ne doit pas empêcher le tableau de bord de s'ouvrir. */
      return defaultPreferences()
    }
  }

  async saveProjects(preferences: ProjectPreferences): Promise<ProjectPreferences> {
    const clean = sanitize(preferences)

    await Preference.updateOrCreate({ key: PROJECTS_KEY }, { value: JSON.stringify(clean) })
    return clean
  }
}

/** On ne fait confiance ni au stockage ni à la requête : seules des listes de chaînes entrent. */
function sanitize(value: unknown): ProjectPreferences {
  const raw = (value ?? {}) as Partial<Record<keyof ProjectPreferences, unknown>>
  const strings = (input: unknown): string[] =>
    Array.isArray(input) ? [...new Set(input.filter((item) => typeof item === 'string'))] : []

  return {
    hiddenEnvironments: strings(raw.hiddenEnvironments),
    hiddenLists: strings(raw.hiddenLists),
    environmentOrder: strings(raw.environmentOrder),
    hiddenFields: strings(raw.hiddenFields),
  }
}
