import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import env from '#start/env'
import config from '#config/clickup_daily'
import { ClickUpClient } from '#clickup/client'
import { ClickUpError } from '#clickup/errors'
import { ReportBuilder } from '#services/report_builder'
import { RunRepository } from '#services/run_repository'
import type { HttpContext } from '@adonisjs/core/http'

/** Une collecte à la fois : un second clic répond « déjà en cours ». */
let running = false

export default class RefreshController {
  /**
   * Relance une collecte depuis le tableau de bord.
   *
   * Le run est enregistré avec le déclencheur « refresh », donc il ne déplace
   * pas la référence du diff : « ce qui a changé » continue de se comparer au
   * rapport du matin, pas au clic précédent.
   */
  @inject()
  async store(
    { response, session, logger }: HttpContext,
    builder: ReportBuilder,
    runs: RunRepository
  ) {
    if (running) {
      session.flash('error', 'Une collecte est déjà en cours.')
      return response.redirect().back()
    }

    running = true
    const buildLogger = {
      debug: (message: string) => logger.debug(message),
      info: (message: string) => logger.info(message),
      warn: (message: string) => logger.warn(message),
    }

    try {
      const now = DateTime.now().setZone(config.timezone)
      const client = new ClickUpClient({
        token: env.get('CLICKUP_API_TOKEN').release(),
        logger: buildLogger,
      })

      const report = await builder.build({
        config,
        client,
        logger: buildLogger,
        now,
        previous: await runs.diffReference(),
      })

      await runs.save(report, 'refresh')
      session.flash(
        'success',
        `Rapport à jour : ${report.stats.total} tâches, ${report.blockers.length} à débloquer ` +
          `(${(report.stats.durationMs / 1000).toFixed(1)} s)`
      )
    } catch (error) {
      const message = error instanceof ClickUpError ? error.message : 'La collecte a échoué.'
      logger.error({ err: error }, 'Rafraîchissement impossible')
      session.flash('error', message)
    } finally {
      running = false
    }

    return response.redirect().toRoute('dashboard')
  }
}
