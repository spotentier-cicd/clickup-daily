import type { DateTime } from 'luxon'
import type { Column, TaskView } from '#domain/task/types'
import type { Blocker } from '#domain/rules/blockers'
import type { Pointage } from '#domain/rules/pointage'
import type { ReportDiff } from '#domain/rules/diff'
import type { GitBranch } from '#domain/git/types'
import type { Mention } from '#domain/mention/types'

/*
| LE CONTRAT.
|
| Tout ce qui a été collecté et calculé pour une journée, en un seul objet typé.
| La page React, l'export Markdown et l'API JSON n'en sont que des vues : c'est
| ce qui empêche la logique métier de se dupliquer dans le rendu, comme elle
| l'était entre render_markdown et render_html dans la v1.
|
| Rien ici ne dépend d'AdonisJS ni d'une base de données.
*/

/** Un commentaire affiché sous une carte. */
export interface TaskComment {
  author: string
  at: DateTime | null
  text: string
}

export interface ReportStats {
  total: number
  mine: number
  bugs: number
  /** Tâches écartées parce qu'elles dorment au fond d'un backlog. */
  backlogExcluded: number
  /** Tâches ramenées dont le statut n'entrait dans aucune colonne. */
  outOfScope: number
  apiCalls: number
  durationMs: number
}

export interface Report {
  generatedAt: DateTime
  timezone: string
  me: { id: number; name: string }
  environments: { key: string; label: string }[]
  columns: Column[]
  tasks: TaskView[]
  /** Par identifiant de tâche. */
  comments: Record<string, TaskComment[]>
  branches: Record<string, GitBranch[]>
  mentions: { mention: Mention; task: TaskView }[]
  blockers: Blocker[]
  pointage: Pointage | null
  diff: ReportDiff
  stats: ReportStats
}
