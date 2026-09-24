import { Bug, Circle, Newspaper, SunHorizon, User } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import type { Task, Veille } from '@/lib/report'

/*
| LES ONGLETS DE LA COLONNE DE GAUCHE.
|
| « Aujourd'hui » n'est pas un filtre de tâches mais la synthèse du matin ;
| « Veille » n'en est pas un non plus. Les deux se reconnaissent à leur
| `filter` nul, et c'est ce qui décide du contenu de la zone principale — pas
| une liste de clés citée en dur dans le rendu.
|
| Les espaces viennent du rapport : un quatrième espace ajouté à la
| configuration apparaît dans la barre sans qu'on retouche ce fichier.
*/

export type Tab = {
  key: string
  label: string
  icon: Icon
  /** Les espaces portent leur pastille de couleur ; les vues transverses non. */
  color?: string
  count: number
  /** Nul pour une vue qui n'est pas un tableau de tâches. */
  filter: ((task: Task) => boolean) | null
}

export interface BuildTabsOptions {
  /** Tâches déjà passées au périmètre, à la recherche et aux facettes. */
  visible: Task[]
  environments: { key: string; label: string }[]
  envColors: Map<string, string>
  blockers: number
  veille: Veille | null
}

export function buildTabs(options: BuildTabsOptions): Tab[] {
  const { visible, environments, envColors, blockers, veille } = options

  const count = (filter: (task: Task) => boolean) => visible.filter(filter).length

  const tabs: Tab[] = [
    { key: 'today', label: "Aujourd'hui", icon: SunHorizon, count: blockers, filter: null },
    {
      key: 'mine',
      label: 'Mes tâches',
      icon: User,
      count: count((task) => task.isMine),
      filter: (task) => task.isMine,
    },
    {
      key: 'bugs',
      label: 'Bugs',
      icon: Bug,
      count: count((task) => task.isBug),
      filter: (task) => task.isBug,
    },
  ]

  for (const environment of environments) {
    const belongs = (task: Task) => task.envKey === environment.key
    tabs.push({
      key: environment.key,
      label: environment.label,
      icon: Circle,
      color: envColors.get(environment.key),
      count: count(belongs),
      filter: belongs,
    })
  }

  if (veille) {
    tabs.push({
      key: 'veille',
      label: 'Veille',
      icon: Newspaper,
      count: veille.articles.length,
      filter: null,
    })
  }

  return tabs
}
