import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Le cache des lectures ClickUp qui coûtent un appel par tâche.
 *
 * Deux usages, une table : les commentaires d'une tâche (clé `comments:<id>`,
 * estampillés par sa date de modification — un commentaire la fait avancer,
 * donc une tâche qui n'a pas bougé n'a pas de nouveau commentaire) et le
 * statut actuel d'une tâche sortie du périmètre (clé `status:<id>`).
 *
 * Sans lui, chaque « Rafraîchir » relisait une centaine de tâches, dépassait
 * le quota de ClickUp et attendait une minute que la fenêtre se rouvre.
 */
export default class extends BaseSchema {
  protected tableName = 'clickup_cache'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      /* `<usage>:<identifiant de tâche>`. */
      table.string('key').notNullable().unique()
      /* Ce qui invalide l'entrée quand ça change : la date de modification. */
      table.string('stamp').notNullable().defaultTo('')
      /* La réponse brute, en JSON, telle que l'API l'a rendue. */
      table.text('payload').notNullable()
      table.timestamp('fetched_at').notNullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
