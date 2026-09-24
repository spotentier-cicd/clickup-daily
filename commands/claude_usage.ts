import { BaseCommand, flags } from '@adonisjs/core/ace'
import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import config from '#config/clickup_daily'
import { ClaudeUsageService } from '#services/claude_usage_service'
import { RunRepository } from '#services/run_repository'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Le coût des conversations, en dehors du rapport.
 *
 * Deux usages : regarder où en est le mois sans lancer une collecte ClickUp,
 * et surtout `--verify`, qui confronte notre tarification à celle que Claude
 * Code a inscrite dans ses propres transcriptions. C'est ce qui empêche la
 * grille de vieillir en silence.
 */
export default class ClaudeUsage extends BaseCommand {
  static commandName = 'claude:usage'
  static description = 'Coût équivalent API des conversations Claude Code du mois'

  static options: CommandOptions = { startApp: true }

  @flags.boolean({ description: 'Compare notre calcul au coût écrit par Claude Code' })
  declare verify: boolean

  @inject()
  async run(claude: ClaudeUsageService, runs: RunRepository) {
    const now = DateTime.now().setZone(config.timezone)

    if (this.verify) return this.#verify(claude)

    const usage = await claude.collect({
      config: config.claude,
      zone: config.timezone,
      now,
      logger: this.logger,
      knownPrefixes: await this.#prefixes(runs),
    })

    if (!usage) {
      this.logger.warning(
        `Aucune transcription lisible dans ${process.env.CLAUDE_TRANSCRIPTS_PATH || config.claude.transcriptsPath}`
      )
      return
    }

    this.logger.info(
      `${usd(usage.totalUsd)} depuis le ${usage.since.toFormat('dd/MM')} · ` +
        `${usage.sessions} conversations · ${usd(usage.todayUsd)} aujourd'hui`
    )

    for (const model of usage.byModel) {
      this.logger.info(`  ${model.model.padEnd(28)} ${usd(model.usd)}`)
    }

    const refs = Object.entries(usage.byRef).slice(0, 10)
    if (refs.length) {
      this.logger.info('Par ticket :')
      for (const [ref, amount] of refs) {
        this.logger.info(`  ${ref.toUpperCase().padEnd(28)} ${usd(amount)}`)
      }
    }
    this.logger.info(`  ${'sans ticket identifié'.padEnd(28)} ${usd(usage.unattributedUsd)}`)

    if (usage.unknownModels.length) {
      this.logger.warning(`Hors total, tarif inconnu : ${usage.unknownModels.join(', ')}`)
    }
  }

  /**
   * Les préfixes de tickets du dernier rapport.
   *
   * Sans eux, le rattachement par texte ramène « GPT-4 » et le segment d'une
   * URL au même titre qu'un vrai ticket. La commande donne donc la même vue
   * que le tableau de bord, et pas une vue plus permissive.
   */
  async #prefixes(runs: RunRepository): Promise<string[]> {
    const run = await runs.latest()
    if (!run) return []

    const tasks = runs.payloadOf(run).tasks
    return [...new Set(tasks.map((task) => task.ref.toLowerCase().split('-')[0]))]
  }

  /**
   * Deux contrôles, dans cet ordre : la grille d'abord, la couverture ensuite.
   *
   * La grille est la seule assertion dure — elle ne dépend pas de notre
   * lecture des fichiers. La couverture, elle, mesure ce que les
   * transcriptions ne disent pas : Claude Code facture des appels auxiliaires
   * (le titre d'une conversation, en Haiku) qu'il n'écrit jamais comme des
   * réponses, et qu'on ne peut donc pas recompter.
   */
  async #verify(claude: ClaudeUsageService) {
    const { pricing, coverage } = await claude.verify(config.claude, config.timezone)
    if (!pricing.length) {
      this.logger.warning('Aucune transcription ne porte de coût de référence.')
      return
    }

    this.logger.info('Grille tarifaire — nos prix appliqués à leurs compteurs :')
    let wrong = 0
    const seen = new Set<string>()

    for (const row of pricing) {
      if (row.ours === null) {
        this.logger.error(`  ${row.model} absent de la grille`)
        wrong++
        continue
      }

      const gap = Math.abs(row.ours - row.theirs) / row.theirs
      if (gap > GRID_TOLERANCE) {
        this.logger.error(
          `  ${row.model.padEnd(30)} nous ${usd(row.ours)} · eux ${usd(row.theirs)} · ${(gap * 100).toFixed(2)} %`
        )
        wrong++
      } else if (!seen.has(row.model)) {
        seen.add(row.model)
        this.logger.success(`  ${row.model.padEnd(30)} exact`)
      }
    }

    this.logger.info(`${pricing.length} relevés vérifiés, ${wrong} hors tolérance`)

    const total = coverage.reduce((sum, row) => sum + row.theirs, 0)
    const ours = coverage.reduce((sum, row) => sum + row.ours, 0)
    const missing = total === 0 ? 0 : (total - ours) / total

    this.logger.info(
      `Couverture des transcriptions : ${usd(ours)} lus sur ${usd(total)} réels ` +
        `(${(missing * 100).toFixed(1)} % d'appels non transcrits, sur ${coverage.length} conversations)`
    )

    if (wrong > 0) {
      this.logger.error('La grille tarifaire ne colle plus : voir app/domain/claude/pricing.ts')
      this.exitCode = 1
    }
  }
}

/**
 * La grille retombe à l'exact sur la quasi-totalité des relevés. Le reste tient
 * à une inconnue : leur ventilation ne dit pas la durée de vie des écritures de
 * cache, qui se paient 1,25 × ou 2 × le prix d'entrée. On la déduit de nos
 * propres relevés, et cette déduction peut glisser d'un point ou deux.
 *
 * Deux pour cent laissent passer cette imprécision-là, et rien d'autre : entre
 * deux modèles, les prix diffèrent d'au moins 25 %.
 */
const GRID_TOLERANCE = 0.02

function usd(amount: number): string {
  return `${amount.toFixed(2)} $`
}
