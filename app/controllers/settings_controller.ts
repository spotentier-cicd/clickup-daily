import { inject } from '@adonisjs/core'
import vine from '@vinejs/vine'
import env from '#start/env'
import config from '#config/clickup_daily'
import { ClickUpClient } from '#clickup/client'
import { mapWithConcurrency } from '#clickup/rate_limiter'
import { buildColumns } from '#domain/task/columns'
import { normalize } from '#domain/text'
import { newStatuses, resolveTeam } from '#domain/scope'
import { PreferencesRepository } from '#services/preferences_repository'
import { RunRepository } from '#services/run_repository'
import type { HttpContext } from '@adonisjs/core/http'
import type { ListInfo, ScopePreferences, SpaceTree } from '#domain/scope'
import type { TaskViewOf } from '#domain/task/types'

const scopeValidator = vine.compile(
  vine.object({
    team: vine.string().nullable(),
    columns: vine.record(vine.string()),
    lists: vine.record(
      vine.object({
        space: vine.string(),
        statuses: vine.array(vine.string()),
        seen: vine.array(vine.string()),
      })
    ),
  })
)

/**
 * La page de paramétrage : l'arborescence ClickUp, et ce qu'on en suit.
 *
 * L'arborescence est lue en direct à chaque ouverture — deux appels par
 * espace. C'est le seul moyen de voir un sprint créé depuis la dernière
 * collecte, et la page est ouverte assez rarement pour que ça ne pèse pas.
 *
 * Les compteurs, eux, viennent du dernier rapport : ils disent ce que chaque
 * liste a réellement pesé dans le tableau, pas ce qu'elle contient dans
 * ClickUp.
 */
export default class SettingsController {
  @inject()
  async index({ inertia }: HttpContext, preferences: PreferencesRepository, runs: RunRepository) {
    const scope = await preferences.scope()
    const columns = buildColumns(config.columns)

    const { teams, team, trees, error } = await this.#discover(scope)

    const run = await runs.latest()
    const report = run ? runs.payloadOf(run) : null
    const seen = countByList(report?.tasks ?? [])

    const dress = (list: ListInfo) => {
      const followed = scope.lists[list.id]
      const counts = seen.get(list.id)

      return {
        id: list.id,
        name: list.name,
        followed: Boolean(followed),
        allowed: followed?.statuses ?? [],
        /** Statuts apparus depuis le dernier tri : masqués, et à valider. */
        fresh: newStatuses(list, scope),
        tasks: counts?.total ?? 0,
        statuses: list.statuses.map((status) => ({
          name: status,
          tasks: counts?.byStatus.get(normalize(status)) ?? 0,
        })),
      }
    }

    return inertia.render('settings', {
      error,
      lastRunAt: run?.ranAt.toISO() ?? null,
      teams,
      team: team?.id ?? null,
      /* Les colonnes bâties : indices normalisés, « Autres » comprise. */
      columns,
      /* Les rattachements explicites ; le reste est proposé côté page. */
      mapping: scope.columns,
      spaces: trees.map((tree) => ({
        id: tree.space.id,
        name: tree.space.name,
        isPrivate: tree.space.private,
        folders: tree.folders
          .filter((folder) => folder.lists.length > 0)
          .map((folder) => ({
            id: folder.id,
            name: folder.name,
            lists: folder.lists.map(dress),
          })),
        lists: tree.lists.map(dress),
      })),
    })
  }

  /** Enregistre le périmètre puis renvoie sur la page. */
  @inject()
  async update({ request, response, session }: HttpContext, preferences: PreferencesRepository) {
    const payload = await scopeValidator.validate(request.all())
    const saved = await preferences.saveScope(payload)

    const count = Object.keys(saved.lists).length
    session.flash(
      'success',
      count
        ? `Périmètre enregistré : ${count} liste${count > 1 ? 's' : ''} suivie${count > 1 ? 's' : ''}.`
        : 'Aucune liste suivie : la prochaine collecte ne ramènera rien.'
    )

    return response.redirect().back()
  }

  /**
   * L'arborescence du workspace.
   *
   * Une panne côté ClickUp ne doit pas fermer la page : elle rend une
   * arborescence vide et le message qui l'explique, pour qu'on ne croie pas
   * que le workspace s'est vidé.
   */
  async #discover(scope: ScopePreferences): Promise<{
    teams: { id: string; name: string }[]
    team: { id: string; name: string } | null
    trees: SpaceTree[]
    error: string | null
  }> {
    try {
      const client = new ClickUpClient({ token: env.get('CLICKUP_API_TOKEN').release() })

      /* Le jeton dit à quelles équipes on a droit ; rien n'est écrit en dur. */
      const teams = await client.teams()
      const team = resolveTeam(teams, scope, process.env.CLICKUP_TEAM_ID)
      if (!team) {
        return { teams, team: null, trees: [], error: 'Ce jeton ne donne accès à aucune équipe.' }
      }

      const spaces = await client.spaces(team.id)
      const trees = await mapWithConcurrency(spaces, 4, (space) => client.spaceTree(space))

      return {
        teams,
        team,
        trees: trees.sort((a, b) => a.space.name.localeCompare(b.space.name, 'fr')),
        error: null,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        teams: [],
        team: null,
        trees: [],
        error: `Impossible de lire ClickUp : ${message}`,
      }
    }
  }
}

/** Ce que le dernier rapport a ramené, par liste puis par statut. */
function countByList(tasks: TaskViewOf<string>[]) {
  const counts = new Map<string, { total: number; byStatus: Map<string, number> }>()

  for (const task of tasks) {
    if (!task.listId) continue

    const entry = counts.get(task.listId) ?? { total: 0, byStatus: new Map<string, number>() }
    entry.total++

    const status = normalize(task.status)
    entry.byStatus.set(status, (entry.byStatus.get(status) ?? 0) + 1)
    counts.set(task.listId, entry)
  }

  return counts
}
