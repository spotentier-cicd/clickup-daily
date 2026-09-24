import { normalize } from '#domain/text'
import type { ClickUpDailyConfig } from '#domain/config/types'

/*
| Règles que les types ne savent pas exprimer.
|
| Le typecheck attrape une clé inconnue ou mal typée. Il ne dit rien de deux
| colonnes qui revendiquent le même statut — le classement d'une tâche
| deviendrait indéterminé, et le tableau mentirait en silence. C'est le genre
| d'erreur que cette fonction rend impossible à ignorer : elle est appelée au
| démarrage et fait échouer le boot, pas le run du matin.
*/

function duplicates(values: string[]): string[] {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) dupes.add(value)
    seen.add(value)
  }
  return [...dupes]
}

export function checkConfigInvariants(config: ClickUpDailyConfig): string[] {
  const problems: string[] = []

  /* Colonnes */
  if (config.columns.length === 0) {
    problems.push('columns est vide : le tableau n’aurait aucune colonne.')
  }
  for (const key of duplicates(config.columns.map((c) => c.key))) {
    problems.push(`columns : la clé "${key}" est utilisée deux fois.`)
  }

  /*
   * « autres » est la colonne d'accueil des statuts hors workflow, ajoutée par
   * buildColumns. Une colonne configurée qui prendrait cette clé la masquerait,
   * et les tâches sans étape disparaîtraient du tableau.
   */
  if (config.columns.some((column) => normalize(column.key) === 'autres')) {
    problems.push('columns : la clé "autres" est réservée à la colonne des statuts hors workflow.')
  }

  /*
   * Les statuts ne sont plus en configuration — ils sont découverts et
   * rattachés dans /parametres. Reste à vérifier que chaque colonne garde de
   * quoi se faire proposer : sans indice, elle n'attrapera jamais un statut
   * d'un workspace qu'on ne connaît pas encore.
   */
  for (const column of config.columns) {
    if (column.hints.length === 0) {
      problems.push(
        `columns.${column.key} : aucun indice, la colonne ne sera jamais proposée sur un workspace inconnu.`
      )
    }
  }

  /* Pointage */
  if (config.temps.weekDays.length === 0) {
    problems.push('temps.weekDays est vide : aucun jour attendu, le manque serait toujours nul.')
  }
  for (const day of config.temps.weekDays) {
    if (!Number.isInteger(day) || day < 0 || day > 6) {
      problems.push(`temps.weekDays : ${day} n’est pas un jour valide (0 = lundi … 6 = dimanche).`)
    }
  }
  for (const day of duplicates(config.temps.weekDays.map(String))) {
    problems.push(`temps.weekDays : le jour ${day} est listé deux fois.`)
  }

  /* Veille */
  const groupKeys = new Set(config.veille.groups.map((g) => g.key))
  for (const key of duplicates(config.veille.groups.map((g) => g.key))) {
    problems.push(`veille.groups : la clé "${key}" est utilisée deux fois.`)
  }
  for (const source of config.veille.sources) {
    if (!groupKeys.has(source.group)) {
      problems.push(
        `veille.sources "${source.label}" : le groupe "${source.group}" n’existe pas dans veille.groups.`
      )
    }
    if (!/^https?:\/\//.test(source.url)) {
      problems.push(`veille.sources "${source.label}" : l’URL doit être en http(s).`)
    }
  }

  /* Bornes numériques : une valeur nulle ou négative vide une section en silence. */
  const positives: [string, number][] = [
    ['staleAfterDays', config.staleAfterDays],
    ['enrich.commentsPerTask', config.enrich.commentsPerTask],
    ['enrich.maxTasks', config.enrich.maxTasks],
    ['blockers.reviewWaitDays', config.blockers.reviewWaitDays],
    ['blockers.recetteWaitDays', config.blockers.recetteWaitDays],
    ['blockers.maxItems', config.blockers.maxItems],
    ['temps.lookbackDays', config.temps.lookbackDays],
    ['temps.targetHoursPerDay', config.temps.targetHoursPerDay],
    ['git.maxBranchesPerTask', config.git.maxBranchesPerTask],
    ['mentions.lookbackDays', config.mentions.lookbackDays],
    ['mentions.scanMaxTasks', config.mentions.scanMaxTasks],
    ['report.keepDays', config.report.keepDays],
    ['report.descriptionExcerptChars', config.report.descriptionExcerptChars],
    ['veille.maxAgeDays', config.veille.maxAgeDays],
    ['veille.perSource', config.veille.perSource],
    ['veille.maxItems', config.veille.maxItems],
    ['veille.timeoutSeconds', config.veille.timeoutSeconds],
  ]
  for (const [path, value] of positives) {
    if (!(value > 0)) {
      problems.push(`${path} doit être strictement positif (valeur : ${value}).`)
    }
  }
  if (config.veille.cacheHours < 0) {
    problems.push(
      `veille.cacheHours ne peut pas être négatif (valeur : ${config.veille.cacheHours}).`
    )
  }

  return problems
}
