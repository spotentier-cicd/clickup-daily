import { Kanban, ListChecks, Newspaper, SunHorizon } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import type { Tab } from '@/lib/tabs'

/*
| LES MODULES DU NOTCH.
|
| La maquette range la navigation sur deux étages : un MODULE, choisi dans le
| sélecteur à gauche du notch, et ses PAGES, posées à côté en onglets
| soulignés. C'est la même liste d'onglets qu'avant — `buildTabs` reste la
| seule source des libellés et des compteurs — mais pliée en deux.
|
| Le pli est celui-ci : « Aujourd'hui », « Mon tableau » et « Veille » ne sont
| pas des listes de tâches, chacun est donc un module d'une seule page, sans
| onglets. Tout ce qui filtre des tâches — mes tâches, les bugs, les espaces —
| tient dans un seul module « Tâches », et ce sont ses onglets.
|
| L'état de navigation ne change pas pour autant : une page reste identifiée
| par sa seule clé d'onglet. Le module s'en déduit, il ne se stocke pas.
*/

export type ModulePage = Tab

export type PageGroup = { label: string; pages: ModulePage[] }

export interface AppModule {
  key: string
  label: string
  icon: Icon
  /** La couleur du module : sa vignette, son soulignement, ses accents. */
  color: string
  pages: ModulePage[]
  /** Les mêmes pages, rangées pour le volet du sélecteur. */
  groups: PageGroup[]
  /** Ce que la vignette du module annonce : le total de ses pages. */
  count: number
}

/** Le fond pastel d'une couleur de module, dans les deux thèmes. */
export function softOf(color: string): string {
  return `color-mix(in srgb, ${color} 14%, var(--color-surface))`
}

/*
| Les couleurs sont des JETONS, pas des hexadécimaux.
|
| Écrites en dur ici, elles ne connaissaient qu'un seul thème : le bleu du
| module « Tâches » était calibré pour du blanc, et sa vignette devenait
| illisible sur fond sombre. La feuille de style en donne les deux versions.
*/
const SOLO: { key: string; label: string; icon: Icon; color: string }[] = [
  { key: 'today', label: "Aujourd'hui", icon: SunHorizon, color: 'var(--color-accent)' },
  { key: 'kanban', label: 'Mon tableau', icon: Kanban, color: 'var(--mod-board)' },
  { key: 'veille', label: 'Veille', icon: Newspaper, color: 'var(--mod-watch)' },
]

const TASKS_COLOR = 'var(--mod-tasks)'

/**
 * Les modules, dans l'ordre du notch.
 *
 * Un module dont toutes les pages ont disparu — la veille coupée, aucun
 * espace suivi — ne s'affiche pas : un sélecteur qui mène à du vide est pire
 * qu'un sélecteur plus court.
 */
export function buildModules(tabs: Tab[]): AppModule[] {
  const byKey = new Map(tabs.map((tab) => [tab.key, tab]))
  const modules: AppModule[] = []

  for (const solo of SOLO) {
    const tab = byKey.get(solo.key)
    if (!tab) continue

    modules.push({
      key: solo.key,
      label: solo.label,
      icon: solo.icon,
      color: solo.color,
      pages: [tab],
      groups: [],
      count: tab.count,
    })
  }

  /* Tout le reste filtre des tâches : c'est un seul module, et ses onglets. */
  const transverse = tabs.filter((tab) => tab.key === 'mine' || tab.key === 'bugs')
  const spaces = tabs.filter((tab) => tab.filter !== null && tab.color !== undefined)
  const pages = [...transverse, ...spaces]

  if (pages.length > 0) {
    modules.splice(1, 0, {
      key: 'tasks',
      label: 'Tâches',
      icon: ListChecks,
      color: TASKS_COLOR,
      pages,
      groups: [
        { label: 'Transverse', pages: transverse },
        { label: 'Espaces', pages: spaces },
      ].filter((group) => group.pages.length > 0),
      count: pages.reduce((total, page) => total + page.count, 0),
    })
  }

  return modules
}

/** Le module qui porte la page ouverte, ou le premier à défaut. */
export function moduleOf(modules: AppModule[], page: string): AppModule {
  return modules.find((entry) => entry.pages.some((p) => p.key === page)) ?? modules[0]
}
