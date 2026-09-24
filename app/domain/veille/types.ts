import type { DateTime } from 'luxon'

/*
| LA VEILLE.
|
| Une poignée d'articles parus depuis dix jours, groupés par famille
| technique, et parmi eux ceux qui citent notre stack. Ce n'est pas un
| lecteur de flux : on ne cherche pas à tout lire, on cherche à ne pas
| rater la dépréciation qui cassera le prochain déploiement.
|
| Comme le reste du contrat, les types sont génériques sur la
| représentation des dates : DateTime côté calcul, ISO côté transport.
*/

/** Un article retenu, tel qu'il s'affiche. */
export type VeilleArticleOf<D> = {
  /** Le lien canonique : c'est lui qui dédoublonne deux flux relayant la même page. */
  id: string
  title: string
  url: string
  /** Libellé de la source, tel qu'il est écrit dans la configuration. */
  source: string
  /** Clé de groupe ; le libellé voyage dans `groups`. */
  group: string
  publishedAt: D | null
  summary: string
  /** Mots-clés de notre stack trouvés dans le titre ou le résumé. */
  highlights: string[]
  /** Paru depuis le rapport de référence. */
  isNew: boolean
}

/**
 * Ce qu'a donné chaque flux, y compris quand il n'a rien donné.
 *
 * Un flux muet ne doit pas se confondre avec un flux sans nouveauté : le
 * premier est une panne à signaler, le second est une bonne nouvelle.
 */
export type VeilleSourceStatus = {
  label: string
  group: string
  reachable: boolean
  kept: number
}

export type VeilleOf<D> = {
  groups: { key: string; label: string }[]
  articles: VeilleArticleOf<D>[]
  sources: VeilleSourceStatus[]
  /** Fenêtre retenue, pour pouvoir l'écrire à l'affichage. */
  lookbackDays: number
}

export type VeilleArticle = VeilleArticleOf<DateTime>
export type Veille = VeilleOf<DateTime>
