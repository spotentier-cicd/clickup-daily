import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Un run = une collecte. Le payload garde le Report sérialisé tel qu'il a été
 * calculé, ce qui permet de réafficher un rapport passé exactement comme il
 * était ce matin-là. Les compteurs sont sortis en colonnes pour les tendances.
 */
export default class extends BaseSchema {
  protected tableName = 'runs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.timestamp('ran_at').notNullable().index()
      /* La journée du run, pour retrouver une archive par sa date. */
      table.string('day').notNullable().index()
      /* Un run planifié fait avancer la référence du diff, un refresh non. */
      table.string('trigger').notNullable().defaultTo('scheduled')

      table.integer('duration_ms').notNullable().defaultTo(0)
      table.integer('api_calls').notNullable().defaultTo(0)
      table.integer('total_tasks').notNullable().defaultTo(0)
      table.integer('my_tasks').notNullable().defaultTo(0)
      table.integer('bug_tasks').notNullable().defaultTo(0)
      table.integer('backlog_excluded').notNullable().defaultTo(0)
      table.integer('blockers').notNullable().defaultTo(0)
      table.integer('week_ms').notNullable().defaultTo(0)

      table.text('payload').notNullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
