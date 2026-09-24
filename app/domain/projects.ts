import type { TaskView } from '#domain/task/types'
import type { EnvironmentConfig } from '#domain/config/types'

/*
| Les « projets » affichés.
|
| Dans ce workspace, « projet » se lit à deux niveaux :
|   — l'ESPACE ClickUp (ROC, ROC New Deal, Tempo), qui vient de la configuration ;
|   — la LISTE (ROC ND Evol, Tempo CICD Only, Tempo Bug Tracking…), qui est l'endroit
|     où vivent réellement les domaines de travail, et qu'on ne peut donc pas
|     déclarer à l'avance : elle se découvre dans les données de chaque run.
|
| Ce module est pur et partagé entre le serveur et le navigateur : il n'y a
| qu'une seule définition de « cette tâche est-elle visible ».
*/

/** Clé stable d'une liste, portée par son espace — deux espaces peuvent avoir la même liste. */
export function listKey(envKey: string, listName: string): string {
  return `${envKey}::${listName}`
}

export interface ProjectList {
  key: string
  name: string
  envKey: string
  total: number
  mine: number
  bugs: number
}

export interface ProjectEnvironment {
  key: string
  label: string
  total: number
  mine: number
  bugs: number
  lists: ProjectList[]
}

/** Ce qui est disponible à l'affichage, avec les compteurs pour décider en connaissance de cause. */
export interface ProjectCatalog {
  environments: ProjectEnvironment[]
}

export interface ProjectPreferences {
  /** Espaces masqués. Absent de la liste = visible : un nouvel espace apparaît par défaut. */
  hiddenEnvironments: string[]
  /** Listes masquées, par leur clé `espace::liste`. */
  hiddenLists: string[]
  /** Ordre d'affichage des espaces ; ceux qui n'y sont pas suivent, dans l'ordre de la config. */
  environmentOrder: string[]
  /**
   * Champs personnalisés masqués sur les cartes.
   *
   * ClickUp en renvoie beaucoup, et certains sont renseignés sur toutes les
   * tâches : « Requester » sur 57 cartes sur 57 n'aide à distinguer aucune
   * tâche des autres, il ne fait qu'épaissir chaque carte.
   */
  hiddenFields: string[]
}

export function defaultPreferences(): ProjectPreferences {
  return { hiddenEnvironments: [], hiddenLists: [], environmentOrder: [], hiddenFields: [] }
}

/**
 * Le catalogue des projets présents dans un rapport.
 *
 * Les espaces viennent de la configuration (pour qu'un espace momentanément
 * vide reste proposé), les listes des tâches réellement ramenées.
 */
export function buildProjectCatalog(
  tasks: TaskView[],
  environments: Pick<EnvironmentConfig, 'key' | 'label'>[]
): ProjectCatalog {
  const byEnv = new Map<string, ProjectEnvironment>(
    environments.map((environment) => [
      environment.key,
      { key: environment.key, label: environment.label, total: 0, mine: 0, bugs: 0, lists: [] },
    ])
  )

  const lists = new Map<string, ProjectList>()

  for (const task of tasks) {
    const environment = byEnv.get(task.envKey)
    if (!environment) continue

    environment.total++
    if (task.isMine) environment.mine++
    if (task.isBug) environment.bugs++

    const name = task.listName || '(sans liste)'
    const key = listKey(task.envKey, name)
    const list = lists.get(key) ?? { key, name, envKey: task.envKey, total: 0, mine: 0, bugs: 0 }

    list.total++
    if (task.isMine) list.mine++
    if (task.isBug) list.bugs++
    lists.set(key, list)
  }

  for (const list of lists.values()) {
    byEnv.get(list.envKey)?.lists.push(list)
  }

  for (const environment of byEnv.values()) {
    environment.lists.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'fr'))
  }

  return { environments: [...byEnv.values()] }
}

/** Une tâche est visible tant que ni son espace ni sa liste ne sont masqués. */
export function isTaskVisible(
  task: Pick<TaskView, 'envKey' | 'listName'>,
  preferences: ProjectPreferences
): boolean {
  if (preferences.hiddenEnvironments.includes(task.envKey)) return false
  return !preferences.hiddenLists.includes(listKey(task.envKey, task.listName || '(sans liste)'))
}

/**
 * Les espaces dans l'ordre choisi. Ceux qui ne sont pas dans environmentOrder
 * suivent, dans l'ordre du catalogue — un espace ajouté à la configuration
 * apparaît donc sans qu'on ait à retoucher les préférences.
 */
export function orderedEnvironments(
  catalog: ProjectCatalog,
  preferences: ProjectPreferences
): ProjectEnvironment[] {
  const rank = new Map(preferences.environmentOrder.map((key, index) => [key, index]))

  return [...catalog.environments].sort((a, b) => {
    const rankA = rank.get(a.key) ?? Number.MAX_SAFE_INTEGER
    const rankB = rank.get(b.key) ?? Number.MAX_SAFE_INTEGER
    return rankA - rankB
  })
}

/** Ce que masquent les préférences, pour pouvoir le dire à l'utilisateur. */
export function countHidden(
  tasks: Pick<TaskView, 'envKey' | 'listName'>[],
  preferences: ProjectPreferences
): number {
  return tasks.filter((task) => !isTaskVisible(task, preferences)).length
}

export interface FieldUsage {
  name: string
  /** Nombre de tâches où le champ est renseigné. */
  count: number
  /** Nombre de valeurs distinctes : un champ à valeur unique ne trie rien. */
  distinct: number
  /**
   * Un champ présent presque partout ne distingue aucune tâche, un champ à
   * valeur unique non plus. Les deux alourdissent la carte sans l'informer.
   */
  noisy: boolean
}

/** Les champs personnalisés réellement présents, avec de quoi décider lesquels garder. */
export function buildFieldCatalog(tasks: Pick<TaskView, 'customFields'>[]): FieldUsage[] {
  const counts = new Map<string, Set<string>>()
  const totals = new Map<string, number>()

  for (const task of tasks) {
    for (const field of task.customFields) {
      totals.set(field.name, (totals.get(field.name) ?? 0) + 1)
      const values = counts.get(field.name) ?? new Set<string>()
      values.add(field.value)
      counts.set(field.name, values)
    }
  }

  const total = tasks.length || 1

  return [...totals.entries()]
    .map(([name, count]) => {
      const distinct = counts.get(name)?.size ?? 0
      return { name, count, distinct, noisy: count / total > 0.8 || distinct <= 1 }
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'fr'))
}

/** Les champs à afficher sur une carte, dans l'ordre d'origine. */
export function visibleFields<T extends { name: string }>(
  fields: T[],
  preferences: Pick<ProjectPreferences, 'hiddenFields'>
): T[] {
  return fields.filter((field) => !preferences.hiddenFields.includes(field.name))
}
