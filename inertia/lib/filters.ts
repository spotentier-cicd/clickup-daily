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
