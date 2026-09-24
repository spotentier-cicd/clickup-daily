/*
| La DISPOSITION est au navigateur, le PÉRIMÈTRE est au serveur.
|
| Ce qu'on regarde (les projets) se persiste côté serveur : ça doit survivre au
| rafraîchissement, valoir sur une archive, et pouvoir être lu par la commande
| de collecte. Où on en est dans la navigation — l'onglet ouvert — reste local
| au navigateur : ça ne mérite ni migration ni validateur.
*/

const KEY = 'cud-tab'

/** L'onglet ouvert au dernier passage, ou l'accueil de la journée. */
export function readTab(): string {
  try {
    return localStorage.getItem(KEY) || 'today'
  } catch {
    return 'today'
  }
}

export function writeTab(tab: string): void {
  try {
    localStorage.setItem(KEY, tab)
  } catch {
    /* L'onglet ne survivra pas au rechargement, ce n'est pas grave. */
  }
}
