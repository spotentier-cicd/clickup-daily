import type { ApplicationService } from '@adonisjs/core/types'
import clickUpDailyConfig from '#config/clickup_daily'
import { checkConfigInvariants } from '#domain/config/invariants'

/**
 * Valide la configuration au démarrage.
 *
 * La v1 lisait config.json en dict non typé et se cassait en plein milieu du
 * run sur une clé manquante. Ici, une configuration incohérente empêche
 * l'application de démarrer, avec la liste des problèmes.
 */
export default class ClickUpDailyProvider {
  constructor(protected app: ApplicationService) {}

  async boot() {
    const problems = checkConfigInvariants(clickUpDailyConfig)
    if (problems.length === 0) return

    throw new Error(
      `Configuration invalide (config/clickup_daily.ts) :\n` +
        problems.map((p) => `  • ${p}`).join('\n')
    )
  }
}
