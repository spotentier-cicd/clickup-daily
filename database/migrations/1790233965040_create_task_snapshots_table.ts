import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * L'état de chaque tâche à chaque run.
 *
 * Sert deux choses que la v1 ne pouvait pas faire : comparer au run précédent
 * sans relire un fichier, et suivre dans le temps (combien de jours une tâche
 * reste en revue, comment la charge évolue).
 */
export default class extends BaseSchema {
  protected tableName = 'task_snapshots'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('run_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('runs')
        .onDelete('CASCADE')

      table.string('task_id').notNullable()
      table.string('ref').notNullable().index()
      table.string('name').notNullable()
      table.string('url').notNullable()
      table.string('env_key').notNullable().index()
      table.string('status').notNullable()
      table.string('column_key').notNullable().index()
      table.text('assignee_ids').notNullable().defaultTo('[]')
      table.boolean('is_mine').notNullable().defaultTo(false)
      table.boolean('is_bug').notNullable().defaultTo(false)
      table.integer('time_estimate_ms').notNullable().defaultTo(0)
      table.integer('time_spent_ms').notNullable().defaultTo(0)
      table.integer('my_time_ms').notNullable().defaultTo(0)

      table.timestamp('created_at')

      table.unique(['run_id', 'task_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
