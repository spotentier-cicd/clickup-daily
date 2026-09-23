import { normalize } from '#domain/text'
import type { Column } from '#domain/task/types'
import type { ColumnConfig } from '#domain/config/types'

/** Prépare les colonnes une fois, statuts normalisés, dans l'ordre du workflow. */
export function buildColumns(columns: ColumnConfig[]): Column[] {
  return columns.map((column, order) => ({
    key: column.key,
    label: column.label,
    match: column.match.map(normalize),
    color: column.color || '#888',
    order,
  }))
}

/**
 * La colonne d'un statut, ou null s'il n'en a aucune — auquel cas la tâche est
 * écartée du rapport. checkConfigInvariants rend ce cas impossible au boot.
 */
export function columnFor(status: string, columns: Column[]): Column | null {
  const normalized = normalize(status)
  return columns.find((column) => column.match.includes(normalized)) ?? null
}
