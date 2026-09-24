import { inject } from '@adonisjs/core'
import { RunRepository } from '#services/run_repository'
import type { HttpContext } from '@adonisjs/core/http'

export default class DashboardController {
  /** Le rapport le plus récent. */
  @inject()
  async index({ inertia }: HttpContext, runs: RunRepository) {
    const run = await runs.latest()

    return inertia.render('dashboard', {
      report: run ? runs.payloadOf(run) : null,
      days: await runs.availableDays(),
      day: run?.day ?? null,
      trigger: run?.trigger ?? null,
    })
  }

  /** Une archive, telle qu'elle était ce jour-là. */
  @inject()
  async show({ inertia, params, response }: HttpContext, runs: RunRepository) {
    const run = await runs.forDay(params.day)
    if (!run) return response.notFound(`Aucun rapport pour le ${params.day}`)

    return inertia.render('dashboard', {
      report: runs.payloadOf(run),
      days: await runs.availableDays(),
      day: run.day,
      trigger: run.trigger,
    })
  }
}
