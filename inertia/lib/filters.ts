import { visibleFields } from '#domain/projects'
import type { FieldUsage, ProjectPreferences } from '@/lib/projects'
import type { Task } from '@/lib/report'

/**
 * Recherche plein texte sur ce qui identifie une tâche. Sans accents ni casse,
 * parce qu'on tape « deploye » aussi souvent que « déployé ».
 */
export function matchesSearch(task: Task, query: string): boolean {
  const needle = normalize(query)
  if (!needle) return true

  const haystack = normalize(
    [
      task.ref,
      task.name,
      task.status,
      task.envLabel,
      task.listName,
      task.taskType,
      task.assignees.join(' '),
      task.customFields.map((field) => `${field.name} ${field.value}`).join(' '),
    ].join(' ')
  )

  return needle.split(' ').every((word) => haystack.includes(word))
}

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
}

/**
 * Les deux champs personnalisés les plus discriminants d'une tâche.
 *
 * On trie par couverture CROISSANTE : un champ renseigné sur 57 tâches sur 57
 * ne distingue rien, un champ rare en dit beaucoup. « Requester » tombe donc
 * toujours en dernier et n'apparaît jamais — sans que personne ait eu à le
 * cocher, et sans figer un nom de champ dans un fichier de configuration.
 */
export function rankFields(
  task: Task,
  catalog: FieldUsage[],
  preferences: Pick<ProjectPreferences, 'hiddenFields'>,
  limit = 2
): Task['customFields'] {
  const couverture = new Map(catalog.map((field) => [field.name, field.count]))

  return [...visibleFields(task.customFields, preferences)]
    .sort(
      (a, b) =>
        (couverture.get(a.name) ?? 0) - (couverture.get(b.name) ?? 0) ||
        a.name.localeCompare(b.name, 'fr')
    )
    .slice(0, limit)
}
