/*
| LES INTERRUPTEURS.
|
| Ce que la page de paramétrage active ou coupe, et qui ne relève ni du
| périmètre ClickUp (`scope`) ni de l'affichage des cartes (`projects`).
|
| Un interrupteur coupé vaut pour les deux bouts de la chaîne : on ne collecte
| plus, et on n'affiche plus ce qui a déjà été collecté. Sans quoi couper le
| coût des conversations le laisserait visible jusqu'au lendemain matin, ce qui
| ne ressemble pas à un interrupteur.
|
| Les archives, elles, ne sont pas réécrites : elles gardent ce qu'elles
| avaient. Rallumer suffit à tout retrouver.
*/
export type AppOptions = {
  /** Le coût équivalent API des conversations Claude Code. */
  claude: boolean
}

/**
 * Tout est éteint tant que personne n'a coché.
 *
 * Le coût des conversations va lire des fichiers qui ne sont pas ceux du
 * projet, dans le dossier personnel. Ça se demande, ça ne se suppose pas : une
 * installation neuve ne touche à rien avant qu'on l'ait cochée dans
 * /parametres.
 */
export function defaultOptions(): AppOptions {
  return { claude: false }
}
