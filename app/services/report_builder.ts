import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import { ClickUpClient } from '#clickup/client'
import { mapWithConcurrency } from '#clickup/rate_limiter'
import { ClickUpError } from '#clickup/errors'
import { branchesForTask, GitService } from '#services/git_service'
import { buildColumns } from '#domain/task/columns'
import { toTaskView } from '#domain/task/view'
import { isBacklog } from '#domain/rules/backlog'
import { buildPointage } from '#domain/rules/pointage'
import { computeBlockers } from '#domain/rules/blockers'
import { computeDiff, toSnapshot } from '#domain/rules/diff'
import { displayTargets, findMentions, mentionTargets } from '#domain/mention/comments'
import { asInt, msToDateTime } from '#domain/time'
import type { Report, ReportStats, TaskComment } from '#domain/report'
import type { TaskView } from '#domain/task/types'
import type { TaskSnapshot } from '#domain/rules/diff'
import type { RawComment } from '#domain/mention/comments'
import type { ClickUpDailyConfig } from '#domain/config/types'
import type { GitBranch } from '#domain/git/types'

export interface BuildLogger {
  debug: (message: string) => void
  info: (message: string) => void
  warn: (message: string) => void
}

export interface BuildReportOptions {
  config: ClickUpDailyConfig
  client: ClickUpClient
  logger: BuildLogger
  now?: DateTime
  /** Run précédent, pour « ce qui a changé ». */
  previous?: { at: DateTime; tasks: TaskSnapshot[] } | null
  skip?: {
    temps?: boolean
    git?: boolean
    mentions?: boolean
    enrich?: boolean
  }
}

/**
 * Orchestration : collecte, puis domaine, puis Report.
 *
 * Tout ce qui est calcul vit dans app/domain ; ce service ne fait que des
 * appels et du câblage. Les trois espaces partent en parallèle — le limiteur
 * de débit partagé garantit qu'on reste sous le quota de ClickUp.
 */
@inject()
export class ReportBuilder {
  constructor(private readonly git: GitService) {}

  async build(options: BuildReportOptions): Promise<Report> {
    const { config, client, logger, previous = null, skip = {} } = options
    const startedAt = Date.now()
    const now = options.now ?? DateTime.now().setZone(config.timezone)
    const teamId = process.env.CLICKUP_TEAM_ID || config.workspaceId

    const me = await client.me()
    const meUserId = asInt(me.id) || config.meUserId
    const meName = me.username ?? ''
    logger.info(`Utilisateur ${meName || meUserId}`)

    const columns = buildColumns(config.columns)
    const taskTypeNames = await client.customItemTypes(teamId)

    /* Les espaces en parallèle : c'était le premier goulot de la v1. */
    const perEnvironment = await mapWithConcurrency(config.environments, 3, async (environment) => {
      logger.info(`Récupération ${environment.key} (espace ${environment.spaceId})…`)
      const raw = await client.teamTasks(teamId, environment.spaceId, environment.statuses)
      return { environment, raw }
    })

    const tasks: TaskView[] = []
    const seen = new Set<string>()
    let backlogExcluded = 0
    let outOfScope = 0

    for (const { environment, raw } of perEnvironment) {
      let kept = 0
      let excluded = 0

      for (const rawTask of raw) {
        if (seen.has(String(rawTask.id))) continue

        const task = toTaskView({
          raw: rawTask,
          environment,
          columns,
          config,
          meUserId,
          now,
          taskTypeNames,
        })
        if (!task) {
          outOfScope++
          continue
        }

        if (isBacklog(task, config.backlog)) {
          excluded++
          continue
        }

        seen.add(task.id)
        tasks.push(task)
        kept++
      }

      backlogExcluded += excluded
      logger.info(
        `${environment.key} : ${kept} tâches dans le périmètre` +
          (excluded ? ` (${excluded} écartées : non priorisées au fond d'un backlog)` : '')
      )
    }

    const pointage = skip.temps
      ? null
      : await this.#loadPointage(client, teamId, config, now, logger)
    if (pointage) {
      for (const task of tasks) task.myTimeMs = pointage.byTask[task.id] ?? 0
    }

    const branches = await this.#loadBranches(config, tasks, logger, skip.git)
    const { comments, mentions } = await this.#loadComments({
      client,
      config,
      tasks,
      meUserId,
      meName,
      now,
      since: previous?.at ?? null,
      logger,
      skip,
    })

    const diff = computeDiff({
      previous,
      current: tasks,
      meUserId,
      exitStatuses: await this.#exitStatuses(client, previous, tasks, logger),
    })

    const blockers = computeBlockers({
      tasks,
      config: config.blockers,
      staleAfterDays: config.staleAfterDays,
      now,
      mentions,
      branchesByTask: branches,
    })

    const stats: ReportStats = {
      total: tasks.length,
      mine: tasks.filter((task) => task.isMine).length,
      bugs: tasks.filter((task) => task.isBug).length,
      backlogExcluded,
      outOfScope,
      apiCalls: client.requestCount,
      durationMs: Date.now() - startedAt,
    }
    logger.info(
      `${stats.total} tâches (${stats.mine} à moi, ${stats.bugs} bugs) · ` +
        `${stats.apiCalls} appels · ${(stats.durationMs / 1000).toFixed(1)} s`
    )

    return {
      generatedAt: now,
      timezone: config.timezone,
      me: { id: meUserId, name: meName },
      environments: config.environments.map((e) => ({ key: e.key, label: e.label })),
      columns,
      tasks,
      comments,
      branches,
      mentions,
      blockers,
      pointage,
      diff,
      stats,
      thresholds: {
        staleAfterDays: config.staleAfterDays,
        reviewWaitDays: config.blockers.reviewWaitDays,
        recetteWaitDays: config.blockers.recetteWaitDays,
        targetHoursPerDay: config.temps.targetHoursPerDay,
        mentionsLookbackDays: config.mentions.lookbackDays,
      },
    }
  }

  async #loadPointage(
    client: ClickUpClient,
    teamId: string,
    config: ClickUpDailyConfig,
    now: DateTime,
    logger: BuildLogger
  ) {
    if (!config.temps.enabled) return null

    const start = now.minus({ days: config.temps.lookbackDays })
    try {
      const entries = await client.timeEntries(teamId, start.toMillis(), now.toMillis())
      logger.info(
        `Pointage : ${entries.length} entrées de temps sur ${config.temps.lookbackDays} jours`
      )
      return buildPointage(entries, config.temps, config.timezone, now)
    } catch (error) {
      logger.warn(`Temps pointés indisponibles : ${describe(error)}`)
      return null
    }
  }

  async #loadBranches(
    config: ClickUpDailyConfig,
    tasks: TaskView[],
    logger: BuildLogger,
    skip?: boolean
  ): Promise<Record<string, GitBranch[]>> {
    if (skip || !config.git.enabled) return {}

    const index = await this.git.loadBranchIndex(config.git, config.timezone, logger)
    const byTask: Record<string, GitBranch[]> = {}

    for (const task of tasks) {
      const found = branchesForTask(task.ref, index, config.git.maxBranchesPerTask)
      if (found.length) byTask[task.id] = found
    }

    return byTask
  }

  /**
   * Un seul balayage de commentaires sert deux usages : les afficher sous les
   * cartes concernées, et y chercher ce qui me cite. Les tâches déjà lues pour
   * l'affichage ne sont pas relues pour les mentions.
   */
  async #loadComments(options: {
    client: ClickUpClient
    config: ClickUpDailyConfig
    tasks: TaskView[]
    meUserId: number
    meName: string
    now: DateTime
    since: DateTime | null
    logger: BuildLogger
    skip: NonNullable<BuildReportOptions['skip']>
  }) {
    const { client, config, tasks, meUserId, meName, now, since, logger, skip } = options

    const forDisplay = skip.enrich ? [] : displayTargets(tasks, config.enrich)
    const fetched = new Set(forDisplay.map((task) => task.id))
    const forMentions = skip.mentions ? [] : mentionTargets(tasks, config.mentions, fetched)

    const toFetch = [...forDisplay, ...forMentions]
    if (toFetch.length) {
      logger.info(
        `Commentaires : ${forDisplay.length} tâches affichées + ${forMentions.length} balayées`
      )
    }

    const raw: Record<string, RawComment[]> = {}
    await mapWithConcurrency(toFetch, 6, async (task) => {
      try {
        raw[task.id] = await client.comments(task.id)
      } catch (error) {
        logger.warn(`Commentaires indisponibles pour ${task.ref} : ${describe(error)}`)
      }
    })

    const comments: Record<string, TaskComment[]> = {}
    for (const task of forDisplay) {
      const latest = [...(raw[task.id] ?? [])]
        .sort((a, b) => asInt(b.date) - asInt(a.date))
        .slice(0, config.enrich.commentsPerTask)

      if (latest.length) {
        comments[task.id] = latest.map((comment) => ({
          author: comment.user?.username ?? '?',
          at: msToDateTime(comment.date, config.timezone),
          text: (comment.comment_text ?? '').split(/\s+/).filter(Boolean).join(' '),
        }))
      }
    }

    const mentions = skip.mentions
      ? []
      : findMentions({
          tasks,
          comments: raw,
          config: config.mentions,
          meUserId,
          meName,
          zone: config.timezone,
          now,
          since,
        })

    if (mentions.length) logger.info(`${mentions.length} commentaires me concernent`)
    return { comments, mentions }
  }

  /**
   * Statut actuel des tâches sorties du périmètre. Plafonné : c'est un appel
   * par tâche, et la réponse n'est qu'un agrément d'affichage.
   */
  async #exitStatuses(
    client: ClickUpClient,
    previous: { tasks: TaskSnapshot[] } | null,
    current: TaskView[],
    logger: BuildLogger
  ): Promise<Record<string, string>> {
    if (!previous) return {}

    const present = new Set(current.map((task) => task.id))
    const left = previous.tasks.filter((task) => !present.has(task.id)).slice(0, 30)
    const statuses: Record<string, string> = {}

    await mapWithConcurrency(left, 6, async (snapshot) => {
      try {
        const detail = await client.task(snapshot.id)
        statuses[snapshot.id] = detail.status?.status ?? '?'
      } catch (error) {
        if (error instanceof ClickUpError) {
          logger.debug(`Statut de sortie inconnu pour ${snapshot.ref} : ${error.message}`)
        }
      }
    })

    return statuses
  }
}

/** L'instantané retenu pour la comparaison du lendemain. */
export function snapshotOf(report: Report): TaskSnapshot[] {
  return report.tasks.map(toSnapshot)
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
