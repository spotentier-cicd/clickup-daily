import { ClickupCacheSchema } from '#database/schema'

/** Une lecture ClickUp mise de côté. Le sens des clés est dans ClickupCacheRepository. */
export default class ClickupCacheEntry extends ClickupCacheSchema {
  /* Le nom du modèle dit ce qu'est une ligne ; la table, elle, porte le cache. */
  static table = 'clickup_cache'
}
