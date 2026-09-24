import { buildQueue as buildQueueDomain } from '#domain/queue'
import { severityTone } from '@/lib/format'
import type { QueueSectionKey } from '#domain/queue'
import type { Blocker, Report, Task } from '@/lib/report'
import type { Ton } from '@/components/task_row'

export interface QueueEntry {
  task: Task
  reasons?: string[]
  tone: Ton
  moved?: boolean
}

export interface QueueSection {
  key: QueueSectionKey
  title: string
  entries: QueueEntry[]
  /** Ce qu'on écrit quand la section est vide : l'absence se dit. */
  vide: string
  limit: number
}

const TITRES: Record<QueueSectionKey, string> = {
  bloque: 'À débloquer',
  change: 'Ce qui a changé',
  encours: 'En cours chez moi',
}

/** Les tâches qui ne sont pas dans la file : le contenu du plateau. */
export function plateauOf(tasks: Task[], queue: HabilleeQueue): Task[] {
  const dansLaFile = new Set(
    queue.sections.flatMap((section) => section.entries.map((entry) => entry.task.id))
  )
  return tasks.filter((task) => !dansLaFile.has(task.id))
}

export interface HabilleeQueue {
  total: number
  sections: QueueSection[]
}

/** Habille la file du domaine : titres, tons, phrases d'absence. */
export function buildQueue(report: Report, blockers: Blocker[], sinceLabel: string): HabilleeQueue {
  const queue = buildQueueDomain(report, blockers)

  const vides: Record<QueueSectionKey, string> = {
    bloque: 'Rien ne bloque.',
    change: sinceLabel
      ? `Rien de nouveau depuis le ${sinceLabel}.`
      : 'Premier rapport : rien à comparer.',
    encours: 'Aucune tâche en cours chez moi.',
  }

  return {
    total: queue.total,
    sections: queue.sections.map((section) => ({
      key: section.key,
      title: TITRES[section.key],
      limit: section.limit,
      vide: vides[section.key],
      entries: section.entries.map((entry) => ({
        task: entry.task,
        reasons: entry.reasons.length > 0 ? entry.reasons : undefined,
        tone: entry.severity === null ? ('muted' as Ton) : severityTone(entry.severity),
        moved: entry.moved,
      })),
    })),
  }
}
