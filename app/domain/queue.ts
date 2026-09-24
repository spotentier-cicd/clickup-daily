import type { ReportOf } from '#domain/report'
import type { BlockerOf } from '#domain/rules/blockers'
import type { TaskViewOf } from '#domain/task/types'

/*
| LA FILE.
|
| Le matin, on ne veut pas « voir ses 57 tâches », on veut savoir quoi faire
| maintenant. La file ne montre donc pas tout : une dizaine de décisions, dans
| l'ordre où les ignorer coûte le plus cher. Le reste n'est pas perdu, il est
| rangé dans le plateau.
|
| C'est une règle produit, pas un détail d'affichage : elle vit donc dans le
| domaine, et elle est testée.
*/

export type QueueSectionKey = 'bloque' | 'change' | 'encours'

export type QueueEntryOf<D> = {
  task: TaskViewOf<D>
  reasons: string[]
  severity: number | null
  /** La tâche a bougé depuis le rapport de référence. */
  moved: boolean
}

export type QueueSectionOf<D> = {
  key: QueueSectionKey
  entries: QueueEntryOf<D>[]
  limit: number
}

export type QueueOf<D> = {
  sections: QueueSectionOf<D>[]
  total: number
}

/** Les colonnes qui comptent comme « en main ». */
const EN_MAIN = new Set(['dev_en_cours', 'revue_a_faire'])

/**
 * Construit la file à partir du rapport et des blocages déjà filtrés.
 *
 * Une tâche n'apparaît qu'une fois : les sections sont dédupliquées dans leur
 * ordre de priorité, sinon la même tâche occuperait trois lignes des dix
 * disponibles.
 */
export function buildQueue<D>(
  report: Pick<ReportOf<D>, 'tasks' | 'diff' | 'mentions'>,
  blockers: BlockerOf<D>[]
): QueueOf<D> {
  const pris = new Set<string>()

  const bloque: QueueEntryOf<D>[] = blockers.map((blocker) => {
    pris.add(blocker.task.id)
    return {
      task: blocker.task,
      reasons: blocker.reasons,
      severity: blocker.severity,
      moved: false,
    }
  })

  const change: QueueEntryOf<D>[] = []
  const ajouter = (task: TaskViewOf<D>, raison: string) => {
    if (pris.has(task.id)) return
    pris.add(task.id)
    change.push({ task, reasons: [raison], severity: null, moved: true })
  }

  for (const task of report.diff.assignedToMe) ajouter(task, 'vient de m’être assignée')
  for (const { mention, task } of report.mentions) {
    if (mention.isNew) ajouter(task, `${mention.author} : ${mention.text}`)
  }
  for (const { task, previousStatus } of report.diff.statusChanged) {
    if (task.isMine) ajouter(task, `${previousStatus} → ${task.status}`)
  }
  for (const task of report.diff.entered) {
    if (task.isMine) ajouter(task, 'entrée dans le périmètre')
  }

  const encours: QueueEntryOf<D>[] = []
  for (const task of report.tasks) {
    if (!task.isMine || pris.has(task.id) || !EN_MAIN.has(task.column)) continue
    pris.add(task.id)
    encours.push({ task, reasons: [], severity: null, moved: false })
  }

  const sections: QueueSectionOf<D>[] = [
    { key: 'bloque', entries: bloque, limit: 6 },
    { key: 'change', entries: change, limit: 6 },
    { key: 'encours', entries: encours, limit: 8 },
  ]

  return { sections, total: sections.reduce((somme, section) => somme + section.entries.length, 0) }
}

/** Ce qui n'est pas dans la file : le contenu du plateau. */
export function plateauTasks<D>(tasks: TaskViewOf<D>[], queue: QueueOf<D>): TaskViewOf<D>[] {
  const dansLaFile = new Set(
    queue.sections.flatMap((section) => section.entries.map((entry) => entry.task.id))
  )
  return tasks.filter((task) => !dansLaFile.has(task.id))
}
