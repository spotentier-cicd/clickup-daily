import { daysAgo } from '#domain/time'
import { branchState, isUnpushed } from '#domain/git/types'
import { compareTasks } from '#domain/task/types'
import type { DateTime } from 'luxon'
import type { TaskView } from '#domain/task/types'
import type { GitBranch } from '#domain/git/types'
import type { Mention } from '#domain/mention/types'
import type { BlockersConfig } from '#domain/config/types'

/*
| « À débloquer en premier ».
|
| La section est ordonnée par ce que coûte le fait de l'ignorer aujourd'hui, pas
| par date : ce qui bloque quelqu'un d'autre passe devant ce qui ne bloque que
| moi. Une même tâche peut cumuler plusieurs raisons, elles sont toutes gardées.
|
| Les clés de colonnes sont citées en dur ici comme dans la v1 : le calcul
| dépend de la place du statut dans le workflow, pas de son libellé.
*/

const COLUMN_DEV = 'dev_en_cours'
const COLUMN_REVIEW = 'revue_a_faire'
const COLUMN_RECETTE = 'recette'

/** Plus le nombre est petit, plus ça coûte de l'ignorer. */
export const SEVERITY = {
  assignedComment: 0,
  overdue: 1,
  /** Une revue qui attend ma relecture : là, je bloque quelqu'un. */
  blockingSomeoneElse: 2,
  unpushedWork: 3,
  myReviewWaiting: 4,
  stale: 5,
  recette: 6,
} as const

export interface Blocker {
  task: TaskView
  reasons: string[]
  severity: number
  /** Ancienneté de la raison la plus vieille, en jours. */
  age: number
}

export interface ComputeBlockersOptions {
  tasks: TaskView[]
  config: BlockersConfig
  staleAfterDays: number
  now: DateTime
  mentions?: { mention: Mention; task: TaskView }[]
  /** Branches locales par identifiant de tâche. */
  branchesByTask?: Record<string, GitBranch[]>
}

/**
 * Renvoie tous les blocages triés, sans les tronquer : c'est à l'affichage
 * d'appliquer blockers.maxItems, pour pouvoir dire combien sont masqués.
 */
export function computeBlockers(options: ComputeBlockersOptions): Blocker[] {
  const { tasks, config, staleAfterDays, now, mentions = [], branchesByTask = {} } = options
  const found = new Map<string, Blocker>()

  const add = (task: TaskView, reason: string, severity: number, age = 0) => {
    const blocker = found.get(task.id) ?? {
      task,
      reasons: [],
      severity: Number.MAX_SAFE_INTEGER,
      age: 0,
    }
    blocker.reasons.push(reason)
    blocker.severity = Math.min(blocker.severity, severity)
    blocker.age = Math.max(blocker.age, age)
    found.set(task.id, blocker)
  }

  /* 1. Un commentaire qui m'est assigné et non résolu : quelqu'un attend une action. */
  for (const { mention, task } of mentions) {
    if (!mention.assigned || mention.resolved) continue
    add(
      task,
      `📌 commentaire de ${mention.author} qui m'est assigné, non résolu`,
      SEVERITY.assignedComment,
      daysAgo(mention.when, now) ?? 0
    )
  }

  for (const task of tasks) {
    const waited = task.staleDays ?? 0

    /* 2. Mon échéance est passée. */
    if (task.isMine && task.isOverdue) {
      add(
        task,
        `⏰ échéance dépassée depuis ${task.overdueDays} j`,
        SEVERITY.overdue,
        task.overdueDays
      )
    }

    /* 3. Une revue attend MA relecture : je bloque le dev qui l'a poussée. */
    if (task.column === COLUMN_REVIEW && !task.isMine && waited >= config.reviewWaitDays) {
      const who = task.assignees.join(', ') || 'non assignée'
      add(
        task,
        `👀 attend une relecture depuis ${waited} j (dev : ${who})`,
        SEVERITY.blockingSomeoneElse,
        waited
      )
    }

    /* 4. Du travail qui n'existe que sur mon poste. */
    if (task.isMine && (task.column === COLUMN_DEV || task.column === COLUMN_REVIEW)) {
      for (const branch of branchesByTask[task.id] ?? []) {
        const state = branchState(branch)
        if (state && isUnpushed(branch)) {
          add(
            task,
            `🔀 ${branch.repo} · ${branch.name} : ${state}`,
            SEVERITY.unpushedWork,
            daysAgo(branch.lastCommit, now) ?? 0
          )
        }
      }
    }

    /* 5. Ma tâche attend une relecture : à relancer. */
    if (task.isMine && task.column === COLUMN_REVIEW && waited >= config.reviewWaitDays) {
      add(
        task,
        `👀 ma tâche attend une relecture depuis ${waited} j`,
        SEVERITY.myReviewWaiting,
        waited
      )
    }

    /* 6. Ma tâche en cours n'a pas bougé. */
    if (task.isMine && task.column === COLUMN_DEV && waited >= staleAfterDays) {
      add(task, `🕸️ sans activité depuis ${waited} j`, SEVERITY.stale, waited)
    }

    /* 7. Ma tâche dort sur recette. */
    if (task.isMine && task.column === COLUMN_RECETTE && waited >= config.recetteWaitDays) {
      add(task, `📦 sur recette depuis ${waited} j, sans retour`, SEVERITY.recette, waited)
    }
  }

  return [...found.values()].sort(
    (a, b) => a.severity - b.severity || b.age - a.age || compareTasks(a.task, b.task)
  )
}
