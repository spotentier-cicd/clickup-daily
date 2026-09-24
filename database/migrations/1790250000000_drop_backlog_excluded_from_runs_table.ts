import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Le compteur du backlog disparaît avec la règle qui le remplissait.
 *
 * Les statuts se choisissent désormais liste par liste dans le paramétrage :
 * une tâche « nouveau » au fond d'un dossier Backlog n'est plus écartée par
 * une heuristique, elle est là ou non selon ce qui a été coché. Une colonne
 * qui ne serait plus alimentée dirait toujours zéro, ce qui se lirait comme
 * « rien n'a été écarté » — donc on l'enlève.
 */
export default class extends BaseSchema {
  protected tableName = 'runs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('backlog_excluded')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('backlog_excluded').notNullable().defaultTo(0)
    })
  }
}
