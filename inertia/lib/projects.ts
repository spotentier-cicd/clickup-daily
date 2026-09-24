import { useCallback, useMemo, useState } from 'react'
import { router } from '@inertiajs/react'
import { defaultPreferences, isTaskVisible, listKey } from '#domain/projects'
import type { ProjectCatalog, ProjectPreferences } from '#domain/projects'
import type { Report, Task } from '@/lib/report'

/*
| Application des préférences de projets à l'affichage.
|
| La règle de visibilité elle-même vient du domaine (isTaskVisible), partagée
| avec le serveur. Ici on ne fait que la propager au reste du rapport : un
| blocage ou une mention dont la tâche est masquée doit disparaître aussi,
| sinon le tableau de bord se contredirait.
*/

export type { ProjectCatalog, ProjectPreferences }

export interface FilteredReport {
  tasks: Task[]
  blockers: Report['blockers']
  mentions: Report['mentions']
  /** Tâches retirées par le choix des projets, pour pouvoir le dire. */
  hiddenCount: number
  counts: { total: number; mine: number; bugs: number }
}

export function filterReport(report: Report, preferences: ProjectPreferences): FilteredReport {
  const tasks = report.tasks.filter((task) => isTaskVisible(task, preferences))
  const visibleIds = new Set(tasks.map((task) => task.id))

  return {
    tasks,
    blockers: report.blockers.filter((blocker) => visibleIds.has(blocker.task.id)),
    mentions: report.mentions.filter((mention) => visibleIds.has(mention.task.id)),
    hiddenCount: report.tasks.length - tasks.length,
    counts: {
      total: tasks.length,
      mine: tasks.filter((task) => task.isMine).length,
      bugs: tasks.filter((task) => task.isBug).length,
    },
  }
}

/**
 * Les préférences, appliquées tout de suite à l'écran et enregistrées en
 * arrière-plan. On n'attend pas le serveur pour redessiner : cocher une case
 * ne doit pas donner l'impression de ramer.
 */
export function useProjectPreferences(initial: ProjectPreferences) {
  const [preferences, setPreferences] = useState(initial)

  const persist = useCallback((next: ProjectPreferences) => {
    setPreferences(next)
    router.put('/preferences/projects', next as never, {
      preserveScroll: true,
      preserveState: true,
      only: [],
    })
  }, [])

  const actions = useMemo(
    () => ({
      toggleEnvironment(key: string) {
        const hidden = preferences.hiddenEnvironments.includes(key)
        persist({
          ...preferences,
          hiddenEnvironments: hidden
            ? preferences.hiddenEnvironments.filter((item) => item !== key)
            : [...preferences.hiddenEnvironments, key],
        })
      },

      toggleList(envKey: string, listName: string) {
        const key = listKey(envKey, listName)
        const hidden = preferences.hiddenLists.includes(key)
        persist({
          ...preferences,
          hiddenLists: hidden
            ? preferences.hiddenLists.filter((item) => item !== key)
            : [...preferences.hiddenLists, key],
        })
      },

      /** Ne montrer qu'un espace : le geste le plus fréquent quand on se concentre. */
      onlyEnvironment(catalog: ProjectCatalog, key: string) {
        persist({
          ...preferences,
          hiddenEnvironments: catalog.environments
            .map((environment) => environment.key)
            .filter((item) => item !== key),
          hiddenLists: preferences.hiddenLists.filter((item) => item.startsWith(`${key}::`)),
        })
      },

      toggleField(name: string) {
        const hidden = preferences.hiddenFields.includes(name)
        persist({
          ...preferences,
          hiddenFields: hidden
            ? preferences.hiddenFields.filter((item) => item !== name)
            : [...preferences.hiddenFields, name],
        })
      },

      reset() {
        persist(defaultPreferences())
      },
    }),
    [preferences, persist]
  )

  const isEnvironmentVisible = (key: string) => !preferences.hiddenEnvironments.includes(key)
  const isListVisible = (envKey: string, listName: string) =>
    !preferences.hiddenLists.includes(listKey(envKey, listName))
  const isFieldVisible = (name: string) => !preferences.hiddenFields.includes(name)

  return { preferences, isEnvironmentVisible, isListVisible, isFieldVisible, ...actions }
}
