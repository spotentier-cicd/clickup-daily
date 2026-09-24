import { inject } from '@adonisjs/core'
import config from '#config/clickup_daily'
import { RunRepository } from '#services/run_repository'
import { PreferencesRepository } from '#services/preferences_repository'
import { buildProjectCatalog } from '#domain/projects'
import type { HttpContext } from '@adonisjs/core/http'
import type Run from '#models/run'
import type { SerializedReport } from '#domain/report_serializer'

export default class DashboardController {
  /** Le rapport le plus récent. */
  @inject()
  async index({ inertia }: HttpContext, runs: RunRepository, preferences: PreferencesRepository) {
    const run = await runs.latest()
    return inertia.render('dashboard', await this.#props(run, runs, preferences))
  }

  /** Une archive, telle qu'elle était ce jour-là. */
  @inject()
  async show(
    { inertia, params, response }: HttpContext,
    runs: RunRepository,
    preferences: PreferencesRepository
  ) {
    const run = await runs.forDay(params.day)
    if (!run) return response.notFound(`Aucun rapport pour le ${params.day}`)

    return inertia.render('dashboard', await this.#props(run, runs, preferences))
  }

  async #props(run: Run | null, runs: RunRepository, preferences: PreferencesRepository) {
    const report = run ? runs.payloadOf(run) : null

    return {
      report,
      /*
       * Le catalogue est recalculé à chaque affichage : les listes n'existent
       * que dans les données, et elles bougent d'un sprint à l'autre.
       */
      catalog: buildProjectCatalog(
        (report?.tasks ?? []) as never,
        config.environments.map((environment) => ({
          key: environment.key,
          label: environment.label,
        }))
      ),
      preferences: await preferences.projects(),
      days: await runs.availableDays(),
      day: run?.day ?? null,
      trigger: run?.trigger ?? null,
    } satisfies { report: SerializedReport | null } & Record<string, unknown>
  }
}
