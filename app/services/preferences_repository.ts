import Preference from '#models/preference'
import { defaultPreferences } from '#domain/projects'
import { defaultScope } from '#domain/scope'
import type { ProjectPreferences } from '#domain/projects'
import type { ScopePreferences } from '#domain/scope'

const PROJECTS_KEY = 'projects'
const SCOPE_KEY = 'scope'

/**
 * Les réglages de l'utilisateur.
 *
 * Deux jeux, et deux portées bien distinctes :
 *
 *   — `projects` est un réglage d'AFFICHAGE, piloté depuis le panneau de
 *     périmètre du tableau de bord. Il ne touche pas à la collecte : un projet
 *     masqué est quand même ramené et enregistré, donc réaffichable sans
 *     relancer d'appels, et les archives restent complètes, donc honnêtes.
 *
 *   — `scope` est le réglage de la page de paramétrage. Sa partie « espaces »
 *     décide de la COLLECTE elle-même — un espace non coché n'est jamais
 *     interrogé — tandis que sa partie « types » reste de l'affichage.
 */
export class PreferencesRepository {
  async projects(): Promise<ProjectPreferences> {
    return this.#read(PROJECTS_KEY, sanitizeProjects, defaultPreferences)
  }

  async saveProjects(preferences: ProjectPreferences): Promise<ProjectPreferences> {
    const clean = sanitizeProjects(preferences)

    await Preference.updateOrCreate({ key: PROJECTS_KEY }, { value: JSON.stringify(clean) })
    return clean
  }

  async scope(): Promise<ScopePreferences> {
    return this.#read(SCOPE_KEY, sanitizeScope, defaultScope)
  }

  async saveScope(scope: ScopePreferences): Promise<ScopePreferences> {
    const clean = sanitizeScope(scope)

    await Preference.updateOrCreate({ key: SCOPE_KEY }, { value: JSON.stringify(clean) })
    return clean
  }

  /** Une valeur illisible ne doit pas empêcher le tableau de bord de s'ouvrir. */
  async #read<T>(key: string, sanitize: (value: unknown) => T, fallback: () => T): Promise<T> {
    const row = await Preference.findBy('key', key)
    if (!row) return fallback()

    try {
      return sanitize(JSON.parse(row.value))
    } catch {
      return fallback()
    }
  }
}

/** On ne fait confiance ni au stockage ni à la requête : seules des listes de chaînes entrent. */
function strings(input: unknown): string[] {
  return Array.isArray(input) ? [...new Set(input.filter((item) => typeof item === 'string'))] : []
}

function sanitizeProjects(value: unknown): ProjectPreferences {
  const raw = (value ?? {}) as Partial<Record<keyof ProjectPreferences, unknown>>

  return {
    hiddenEnvironments: strings(raw.hiddenEnvironments),
    hiddenLists: strings(raw.hiddenLists),
    environmentOrder: strings(raw.environmentOrder),
    hiddenFields: strings(raw.hiddenFields),
  }
}

function sanitizeScope(value: unknown): ScopePreferences {
  const raw = (value ?? {}) as Partial<Record<keyof ScopePreferences, unknown>>
  const lists: ScopePreferences['lists'] = {}
  const columns: ScopePreferences['columns'] = {}

  if (raw.columns && typeof raw.columns === 'object' && !Array.isArray(raw.columns)) {
    for (const [status, column] of Object.entries(raw.columns)) {
      /* La chaîne vide est un choix — « aucune étape » — donc elle se garde. */
      if (typeof column === 'string') columns[status] = column
    }
  }

  if (raw.lists && typeof raw.lists === 'object' && !Array.isArray(raw.lists)) {
    for (const [id, entry] of Object.entries(raw.lists)) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue

      const { space, statuses, seen } = entry as {
        space?: unknown
        statuses?: unknown
        seen?: unknown
      }
      if (typeof space !== 'string' || !space) continue

      /*
       * Une liste de statuts vide se garde : elle dit « cette liste est suivie
       * mais je n'en veux aucun statut », ce qui est un choix, pas une absence.
       * `seen` absent d'un enregistrement ancien reste vide : « on ne sait pas
       * ce que la liste proposait alors », et rien ne se signalera comme
       * nouveau — ce qui vaut mieux que de tout signaler.
       */
      lists[id] = { space, statuses: strings(statuses), seen: strings(seen) }
    }
  }

  return { team: typeof raw.team === 'string' && raw.team ? raw.team : null, lists, columns }
}
