import { RunSchema } from '#database/schema'
import { hasMany } from '@adonisjs/lucid/orm'
import TaskSnapshot from '#models/task_snapshot'
import type { HasMany } from '@adonisjs/lucid/types/relations'

/** Une collecte. Le payload garde le Report sérialisé tel qu'il a été calculé. */
export default class Run extends RunSchema {
  @hasMany(() => TaskSnapshot)
  declare snapshots: HasMany<typeof TaskSnapshot>
}
