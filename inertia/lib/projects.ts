import { useCallback, useMemo, useState } from 'react'
import { router } from '@inertiajs/react'
import { defaultPreferences, isTaskVisible, listKey } from '#domain/projects'
import { isTaskInScope } from '#domain/scope'
import type { FieldUsage, ProjectCatalog, ProjectPreferences } from '#domain/projects'
import type { ScopePreferences } from '#domain/scope'
import type { Report, Task } from '@/lib/report'

/*
| Application des préférences de projets à l'affichage.
|
| La règle de visibilité elle-même vient du domaine (isTaskVisible), partagée
| avec le serveur. Ici on ne fait que la propager au reste du rapport : un
| blocage ou une mention dont la tâche est masquée doit disparaître aussi,
| sinon le tableau de bord se contredirait.
*/

export type { FieldUsage, ProjectCatalog, ProjectPreferences, ScopePreferences }

export interface FilteredReport {
  tasks: Task[]
  blockers: Report['blockers']
  /**
   * Blocages retirés par le périmètre.
   *
   * On ne les jette PAS : le seul objet de cette page qu'on ne peut pas se
   * permettre de rater, c'est un blocage. Ils sont montrés à part, avec de quoi
   * réafficher le projet concerné.
   */
  hiddenBlockers: Report['blockers']
  mentions: Report['mentions']
  diff: Report['diff']
  /** Tâches retirées par le choix des projets, pour pouvoir le dire. */
  hiddenCount: number
  /** Tâches hors du périmètre réglé dans /parametres : liste ou statut décoché. */
  hiddenByScope: number
  counts: { total: number; mine: number; bugs: number }
}

/**
 * Applique le périmètre à l'affichage.
 *
 * Le périmètre ne touche JAMAIS à la collecte : les tâches masquées continuent
 * d'être ramassées et archivées. Sinon computeDiff verrait des entrées et des
 * sorties fantômes à chaque changement de périmètre.
 */
export function filterReport(
  report: Report,
  preferences: ProjectPreferences,
  scope: ScopePreferences
): FilteredReport {
  /*
   * Deux filtres, deux origines, comptés séparément — sinon « 12 masquées » ne
   * dirait pas où aller les rechercher :
   *
   *   1. le périmètre réglé dans /parametres — liste suivie, statut coché.
   *      Décocher fait sortir la tâche du tableau IMMÉDIATEMENT, y compris
   *      d'un rapport déjà collecté : la case vaut pour ce qu'on voit, pas
   *      seulement pour la prochaine collecte ;
   *   2. le panneau de périmètre, qui ne fait que resserrer la vue du moment.
   */
  const inScope = report.tasks.filter((task) => isTaskInScope(task, scope))
  const tasks = inScope.filter((task) => isTaskVisible(task, preferences))
  const visibleIds = new Set(tasks.map((task) => task.id))
  const dansLePerimetre = (t: { id: string }) => visibleIds.has(t.id)

  return {
    tasks,
    blockers: report.blockers.filter((blocker) => dansLePerimetre(blocker.task)),
    hiddenBlockers: report.blockers.filter((blocker) => !dansLePerimetre(blocker.task)),
    mentions: report.mentions.filter((mention) => dansLePerimetre(mention.task)),
    diff: {
      ...report.diff,
      entered: report.diff.entered.filter(dansLePerimetre),
      statusChanged: report.diff.statusChanged.filter((change) => dansLePerimetre(change.task)),
      assignedToMe: report.diff.assignedToMe.filter(dansLePerimetre),
      /*
       * diff.left n'est filtré que par espace : TaskSnapshot ne porte pas de
       * listName. Le filtrer par liste supposerait de changer la table
       * task_snapshots, donc de rendre les archives incomparables — hors de
       * question pour un filtre d'affichage.
       */
      left: report.diff.left.filter(
        (sortie) => !preferences.hiddenEnvironments.includes(sortie.snapshot.envKey)
      ),
    },
    hiddenCount: inScope.length - tasks.length,
    hiddenByScope: report.tasks.length - inScope.length,
    counts: {
      total: tasks.length,
      mine: tasks.filter((task) => task.isMine).length,
      bugs: tasks.filter((task) => task.isBug).length,
    },
  }
}

/** L'API du hook, déclarée explicitement plutôt qu'inférée. */
export interface ProjectControls {
  preferences: ProjectPreferences
  isEnvironmentVisible: (key: string) => boolean
  isListVisible: (envKey: string, listName: string) => boolean
  isFieldVisible: (name: string) => boolean
  toggleEnvironment: (key: string) => void
  toggleList: (envKey: string, listName: string) => void
  toggleField: (name: string) => void
  /** Ne montrer qu'un espace : le geste le plus fréquent quand on se concentre. */
  onlyEnvironment: (catalog: ProjectCatalog, key: string) => void
  onlyList: (catalog: ProjectCatalog, envKey: string, listName: string) => void
  hideNoisyFields: (fields: { name: string; noisy: boolean }[]) => void
  reset: () => void
}

/**
 * Les préférences, appliquées tout de suite à l'écran et enregistrées en
 * arrière-plan. On n'attend pas le serveur pour redessiner : cocher une case
 * ne doit pas donner l'impression de ramer.
 */
export function useProjectPreferences(initial: ProjectPreferences): ProjectControls {
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

      onlyEnvironment(catalog: ProjectCatalog, key: string) {
        persist({
          ...preferences,
          hiddenEnvironments: catalog.environments
            .map((environment) => environment.key)
            .filter((item) => item !== key),
          hiddenLists: preferences.hiddenLists.filter((item) => item.startsWith(`${key}::`)),
        })
      },

      /** N'afficher qu'une liste : le geste quotidien réel. */
      onlyList(catalog: ProjectCatalog, envKey: string, listName: string) {
        const garde = listKey(envKey, listName)
        persist({
          ...preferences,
          hiddenEnvironments: [],
          hiddenLists: catalog.environments
            .flatMap((environment) => environment.lists.map((list) => list.key))
            .filter((key) => key !== garde),
        })
      },

      /** Masque en un clic les champs que buildFieldCatalog a déjà mesurés comme peu utiles. */
      hideNoisyFields(fields: { name: string; noisy: boolean }[]) {
        persist({
          ...preferences,
          hiddenFields: [
            ...new Set([
              ...preferences.hiddenFields,
              ...fields.filter((field) => field.noisy).map((field) => field.name),
            ]),
          ],
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
