import { normalize } from '#domain/text'
import type { Column, ColumnMapping } from '#domain/task/types'
import type { ColumnConfig } from '#domain/config/types'

/*
| LES COLONNES DU TABLEAU.
|
| Une colonne est une ÉTAPE DU WORKFLOW — en cours, en revue, en recette — pas
| un statut ClickUp. Les statuts, eux, changent d'un workspace à l'autre : « in
| progress » chez l'un, « dev en cours » chez l'autre. Le rattachement des uns
| aux autres ne peut donc pas vivre dans un fichier de configuration.
|
| Il vit dans les réglages, et il se remplit tout seul au premier passage :
| `proposeColumn` devine à partir de fragments de mots, français et anglais.
| C'est ce qui fait qu'un workspace inconnu s'affiche correctement dès le
| premier rapport, sans que personne ait rien réglé. Un choix explicite fait
| dans /parametres l'emporte toujours — y compris le choix de n'en donner
| aucune, qui range le statut dans « Autres ».
*/

/**
 * La colonne d'accueil des statuts hors workflow.
 *
 * Les statuts se choisissent liste par liste : on peut demander à voir
 * « pause » ou « production », des états qu'aucune étape ne modélise. Ils ont
 * besoin d'une place, sinon la tâche demandée disparaîtrait sans un mot. Cette
 * colonne est la dernière, et les règles de blocage l'ignorent : elles
 * raisonnent sur la place dans le workflow, qu'un statut « autre » n'a pas.
 */
export const OTHER_COLUMN = 'autres'

const OTHER: Column = {
  key: OTHER_COLUMN,
  label: 'Autres',
  hints: [],
  color: '#75798c',
  order: Number.MAX_SAFE_INTEGER,
}

/** Prépare les colonnes une fois, indices normalisés, dans l'ordre du workflow. */
export function buildColumns(columns: ColumnConfig[]): Column[] {
  const built = columns.map((column, order) => ({
    key: column.key,
    label: column.label,
    hints: column.hints.map(normalize).filter(Boolean),
    color: column.color || '#888',
    order,
  }))

  built.push({ ...OTHER, order: built.length })
  return built
}

/**
 * La colonne proposée pour un statut, ou null si rien ne s'en approche.
 *
 * DEUX CRITÈRES, DANS CET ORDRE.
 *
 * Le fragment qui apparaît le PLUS TÔT gagne : « revue de code a faire »
 * contient « revue » et « a faire », mais c'est de revue qu'il parle — le mot
 * qui distingue vient en tête, le reste qualifie.
 *
 * À position égale, le PLUS LONG gagne : « revue de code ok » commence par
 * « revue » comme par « revue de code ok », et c'est le second qui décrit
 * l'étape.
 */
export function proposeColumn(status: string, columns: Column[]): Column | null {
  const needle = normalize(status)
  if (!needle) return null

  let best: Column | null = null
  let bestAt = Number.MAX_SAFE_INTEGER
  let bestLength = 0

  for (const column of columns) {
    if (column.key === OTHER_COLUMN) continue

    for (const hint of column.hints) {
      const at = needle.indexOf(hint)
      if (at === -1) continue

      if (at < bestAt || (at === bestAt && hint.length > bestLength)) {
        best = column
        bestAt = at
        bestLength = hint.length
      }
    }
  }

  return best
}

/**
 * La colonne d'un statut : le choix explicite d'abord, la proposition ensuite,
 * « Autres » en dernier recours.
 *
 * Une entrée vide dans la correspondance est un choix, pas une absence : elle
 * dit « ce statut ne va dans aucune étape », et court-circuite la proposition.
 */
export function columnFor(status: string, columns: Column[], mapping: ColumnMapping = {}): Column {
  const other = columns.find((column) => column.key === OTHER_COLUMN) ?? OTHER
  const chosen = mapping[normalize(status)]

  if (chosen !== undefined) {
    return columns.find((column) => column.key === chosen) ?? other
  }

  return proposeColumn(status, columns) ?? other
}
