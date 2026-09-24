/*
| La DISPOSITION est au navigateur, le PÉRIMÈTRE est au serveur.
|
| Ce qu'on regarde (les projets) se persiste côté serveur : ça doit survivre au
| rafraîchissement, valoir sur une archive, et pouvoir être lu par la commande
| de collecte. Comment on le regarde (plateau ouvert, regroupement) reste local
| au navigateur : ça ne mérite ni migration ni validateur.
*/

export type Grouping = 'statut' | 'liste' | 'espace' | 'priorite'

export interface ViewState {
  plateauOuvert: boolean
  regroupement: Grouping
}

const KEY = 'cud-view'

const DEFAUT: ViewState = { plateauOuvert: false, regroupement: 'statut' }

export function readView(): ViewState {
  try {
    const brut = localStorage.getItem(KEY)
    if (!brut) return DEFAUT

    const lu = JSON.parse(brut) as Partial<ViewState>
    const regroupements: Grouping[] = ['statut', 'liste', 'espace', 'priorite']

    return {
      plateauOuvert:
        typeof lu.plateauOuvert === 'boolean' ? lu.plateauOuvert : DEFAUT.plateauOuvert,
      regroupement:
        lu.regroupement && regroupements.includes(lu.regroupement)
          ? lu.regroupement
          : DEFAUT.regroupement,
    }
  } catch {
    /* Navigation privée, stockage bloqué : les valeurs par défaut font l'affaire. */
    return DEFAUT
  }
}

export function writeView(state: ViewState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* La disposition ne survivra pas au rechargement, ce n'est pas grave. */
  }
}
