import { normalize } from '#domain/text'
import type { ClickUpDailyConfig } from '#domain/config/types'

/*
| Règles que les types ne savent pas exprimer.
|
| Le typecheck attrape une clé inconnue ou mal typée. Il ne dit rien d'un statut
| ajouté dans un environnement mais oublié dans les colonnes — la tâche
| disparaîtrait alors du tableau sans un mot. C'est le genre d'erreur que cette
| fonction rend impossible à ignorer : elle est appelée au démarrage et fait
| échouer le boot, pas le run du matin.
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

  /* Environnements */
  if (config.environments.length === 0) {
    problems.push('environments est vide : aucun espace ClickUp à interroger.')
  }
  for (const key of duplicates(config.environments.map((e) => e.key))) {
    problems.push(`environments : la clé "${key}" est utilisée deux fois.`)
  }
  for (const env of config.environments) {
    if (!env.spaceId.trim()) {
      problems.push(`environments.${env.key} : space_id manquant.`)
    }
    if (env.statuses.length === 0) {
      problems.push(`environments.${env.key} : aucun statut listé.`)
    }
  }

  /* Colonnes */
  if (config.columns.length === 0) {
    problems.push('columns est vide : le tableau n’aurait aucune colonne.')
  }
  for (const key of duplicates(config.columns.map((c) => c.key))) {
    problems.push(`columns : la clé "${key}" est utilisée deux fois.`)
  }

  /*
   * Le cœur du contrôle : tout statut ramené de ClickUp doit atterrir dans une
   * colonne, et dans une seule.
   */
  for (const env of config.environments) {
    for (const status of env.statuses) {
      const matching = config.columns.filter((c) =>
        c.match.some((m) => normalize(m) === normalize(status))
      )
      if (matching.length === 0) {
        problems.push(
          `Le statut "${status}" (${env.key}) n’est repris par aucune colonne : ` +
            'les tâches dans ce statut seraient collectées puis absentes du tableau.'
        )
      } else if (matching.length > 1) {
        problems.push(
          `Le statut "${status}" (${env.key}) est repris par ${matching.length} colonnes ` +
            `(${matching.map((c) => c.key).join(', ')}) : le classement serait ambigu.`
        )
      }
    }
  }

  /* Une colonne qui ne correspond à rien est du bruit, pas une erreur fatale. */
  const configuredStatuses = new Set(
    config.environments.flatMap((e) => e.statuses).map((s) => normalize(s))
  )
  for (const column of config.columns) {
    if (!column.match.some((m) => configuredStatuses.has(normalize(m)))) {
      problems.push(
        `La colonne "${column.key}" ne correspond à aucun statut configuré : elle restera toujours vide.`
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
