import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Réglages de l'utilisateur, en clé/valeur JSON.
 *
 * Volontairement générique : ces réglages changent souvent et ne méritent pas
 * une migration à chaque fois. La forme de chaque valeur est typée côté
 * domaine, et validée à la lecture.
 */
export default class extends BaseSchema {
  protected tableName = 'preferences'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('key').notNullable().unique()
      table.text('value').notNullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
