import type { DateTime } from 'luxon'
import type { Column, TaskViewOf } from '#domain/task/types'
import type { BlockerOf } from '#domain/rules/blockers'
import type { PointageOf } from '#domain/rules/pointage'
import type { ReportDiffOf } from '#domain/rules/diff'
import type { GitBranchOf } from '#domain/git/types'
import type { MentionOf } from '#domain/mention/types'
import type { VeilleOf } from '#domain/veille/types'
import type { ClaudeUsageOf } from '#domain/claude/types'

/*
| LE CONTRAT.
|
| Tout ce qui a été collecté et calculé pour une journée, en un seul objet typé.
| La page React, l'export Markdown et l'API JSON n'en sont que des vues : c'est
| ce qui empêche la logique métier de se dupliquer dans le rendu, comme elle
| l'était entre render_markdown et render_html dans la v1.
|
| Le contrat est générique sur la représentation des dates. Report porte des
| DateTime, c'est ce que manipulent les règles ; ReportDto porte des chaînes
| ISO, c'est ce qui part en base et dans les props Inertia. Une seule
| déclaration pour les deux : ils ne peuvent pas diverger.
|
| Rien ici ne dépend d'AdonisJS ni d'une base de données.
*/

/** Un commentaire affiché sous une carte. */
export type TaskCommentOf<D> = {
  author: string
  at: D | null
  text: string
}

export type ReportStats = {
  total: number
  mine: number
  bugs: number
  /**
   * Tâches ramenées par le filtre commun mais hors du choix de leur liste.
   *
   * L'API ne sait filtrer que par une union de statuts ; le tri fin, liste par
   * liste, se fait ici. Ce compteur dit ce que ce tri a écarté.
   */
  outOfScope: number
  apiCalls: number
  durationMs: number
}

/**
 * Les seuils qui ont servi au calcul.
 *
 * Ils voyagent avec le rapport pour que l'affichage puisse dire « sans activité
 * depuis 20 j (seuil : 14) » sans recopier la configuration côté React — une
 * copie qui se serait désynchronisée au premier ajustement.
 */
export type ReportThresholds = {
  staleAfterDays: number
  reviewWaitDays: number
  recetteWaitDays: number
  targetHoursPerDay: number
  mentionsLookbackDays: number
}

export type ReportOf<D> = {
  generatedAt: D
  timezone: string
  me: { id: number; name: string }
  environments: { key: string; label: string }[]
  columns: Column[]
  tasks: TaskViewOf<D>[]
  /** Par identifiant de tâche. */
  comments: Record<string, TaskCommentOf<D>[]>
  branches: Record<string, GitBranchOf<D>[]>
  mentions: { mention: MentionOf<D>; task: TaskViewOf<D> }[]
  blockers: BlockerOf<D>[]
  pointage: PointageOf<D> | null
  /** Articles parus dans la fenêtre de veille ; null quand la veille est coupée. */
  veille: VeilleOf<D> | null
  /**
   * Ce que les conversations Claude Code ont coûté ce mois-ci, au tarif de
   * l'API. Null quand les transcriptions ne sont pas lisibles — en conteneur
   * sans montage, par exemple.
   */
  claude: ClaudeUsageOf<D> | null
  diff: ReportDiffOf<D>
  stats: ReportStats
  thresholds: ReportThresholds
}

/** Ce que manipulent les règles. */
export type Report = ReportOf<DateTime>

/** Ce qui part en base et dans les props Inertia : dates en ISO. */
export type ReportDto = ReportOf<string>

export type TaskComment = TaskCommentOf<DateTime>
