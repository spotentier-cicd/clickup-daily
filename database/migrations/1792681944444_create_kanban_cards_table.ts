import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Le tableau personnel.
 *
 * C'est la seule table que l'utilisateur remplit lui-même : tout le reste du
 * projet est en lecture seule sur ClickUp. Une carte peut donc citer un ticket
 * sans en dépendre — le ticket s'archive, se ferme ou sort du périmètre, la
 * carte reste. D'où la référence conservée en clair plutôt qu'une clé
 * étrangère vers task_snapshots, qui lierait une note à une collecte.
 */
export default class extends BaseSchema {
  protected tableName = 'kanban_cards'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      /* « column » est un mot réservé en SQL : la colonne porte le suffixe. */
      table.string('column_key').notNullable().index()
      /* Rang dans sa colonne, renuméroté à chaque déplacement. */
      table.integer('position').notNullable().defaultTo(0)

      /* Le ticket cité, s'il y en a un. L'identifiant permet d'ouvrir sa fiche. */
      table.string('ref').notNullable().defaultTo('')
      table.string('task_id').notNullable().defaultTo('')
      table.string('title').notNullable().defaultTo('')
      table.string('url').notNullable().defaultTo('')

      /* Les deux branches du moment, front et back, selon ce que le ticket touche. */
      table.string('branch_front').notNullable().defaultTo('')
      table.string('branch_back').notNullable().defaultTo('')

      table.text('comment').notNullable().defaultTo('')

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
