import { BaseCommand, flags } from '@adonisjs/core/ace'
import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import env from '#start/env'
import config from '#config/clickup_daily'
import { ClickUpClient } from '#clickup/client'
import { ClickUpError } from '#clickup/errors'
import { ReportBuilder } from '#services/report_builder'
import { RunRepository } from '#services/run_repository'
import { notify } from '#services/macos_service'
import { formatDurationMs } from '#domain/time'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import type { RunTrigger } from '#services/run_repository'

/**
 * La collecte du matin. Lancée par launchd en semaine, à la main le reste du
 * temps, et par le bouton « Rafraîchir » du tableau de bord.
 */
export default class DailyReport extends BaseCommand {
  static commandName = 'daily:report'
  static description = 'Collecte ClickUp et enregistre le rapport du jour'

  static options: CommandOptions = { startApp: true }

  /*
   * Déclarées en positif : le parseur d'Ace gère lui-même la négation, si bien
   * que --no-temps, --no-git… suffisent et reprennent les options de la v1.
   */
  @flags.boolean({ description: 'Temps pointés (--no-temps pour s’en passer)', default: true })
  declare temps: boolean

  @flags.boolean({ description: 'Branches locales (--no-git pour s’en passer)', default: true })
  declare git: boolean

  @flags.boolean({ description: 'Commentaires qui me citent (--no-mentions)', default: true })
  declare mentions: boolean

  @flags.boolean({ description: 'Commentaires sous les cartes (--no-enrich)', default: true })
  declare enrich: boolean

  @flags.boolean({ description: 'Notification macOS (--no-notify)', default: true })
  declare notify: boolean

  @flags.string({
    description: 'scheduled (déplace la référence du diff), manual ou refresh',
    default: 'manual',
  })
  declare trigger: string

  @inject()
  async run(builder: ReportBuilder, runs: RunRepository) {
    const now = DateTime.now().setZone(config.timezone)
    const triggers: RunTrigger[] = ['scheduled', 'manual', 'refresh']
    const trigger = triggers.includes(this.trigger as RunTrigger)
      ? (this.trigger as RunTrigger)
      : 'manual'

    const logger = {
      debug: (message: string) => this.logger.debug(message),
      info: (message: string) => this.logger.info(message),
      warn: (message: string) => this.logger.warning(message),
    }

    const client = new ClickUpClient({ token: env.get('CLICKUP_API_TOKEN').release(), logger })

    try {
      const previous = await runs.diffReference()
      const report = await builder.build({
        config,
        client,
        logger,
        now,
        previous,
        skip: {
          temps: !this.temps,
          git: !this.git,
          mentions: !this.mentions,
          enrich: !this.enrich,
        },
      })

      const run = await runs.save(report, trigger)
      await runs.purge(config.report.keepDays, now)

      const gap = report.pointage?.gapMs ?? 0
      const summary =
        `${report.stats.mine} tâches à moi · ${report.blockers.length} à débloquer` +
        (gap > 0 ? ` · ${formatDurationMs(gap)} de pointage manquant` : '')

      this.logger.success(`Rapport #${run.id} enregistré — ${summary}`)

      if (this.notify && config.report.notify) await notify('clickup-daily', summary)
    } catch (error) {
      if (error instanceof ClickUpError) {
        this.logger.error(error.message)
        this.exitCode = 1
        return
      }
      throw error
    }
  }
}
