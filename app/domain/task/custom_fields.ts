import { formatDate, msToDateTime } from '#domain/time'
import type { RawCustomField } from '#domain/task/types'

/**
 * Rend lisible la valeur d'un champ personnalisé ClickUp (API v2), dont la
 * forme dépend entièrement du type de champ.
 *
 * Renvoie une chaîne vide quand le champ n'est pas renseigné : l'appelant
 * n'affiche que ce qui a une valeur.
 */
export function customFieldValue(field: RawCustomField, zone: string): string {
  const value = field.value
  if (value === null || value === undefined || value === '') return ''
  if (Array.isArray(value) && value.length === 0) return ''
  if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0)
    return ''

  const options = field.type_config?.options ?? []

  switch (field.type) {
    case 'drop_down': {
      const option = options.find(
        (o) =>
          value === o.orderindex ||
          String(value) === String(o.id) ||
          String(value) === String(o.name)
      )
      return option ? String(option.name ?? '').trim() : String(value)
    }

    case 'labels': {
      const labels = new Map(options.map((o) => [o.id, o.label]))
      const ids = Array.isArray(value) ? value : [value]
      return ids.map((id) => String(labels.get(String(id)) ?? id)).join(', ')
    }

    case 'users': {
      const users = Array.isArray(value) ? value : [value]
      return users
        .map((user) =>
          user && typeof user === 'object'
            ? String(
                (user as Record<string, unknown>).username ??
                  (user as Record<string, unknown>).email ??
                  (user as Record<string, unknown>).id
              )
            : String(user)
        )
        .join(', ')
    }

    case 'date':
      return formatDate(msToDateTime(value, zone))

    case 'checkbox':
      return ['true', '1'].includes(String(value).toLowerCase()) ? 'oui' : 'non'

    case 'tasks':
    case 'list_relationship': {
      const items = Array.isArray(value) ? value : [value]
      return items
        .map((item) =>
          item && typeof item === 'object'
            ? String(
                (item as Record<string, unknown>).custom_id ??
                  (item as Record<string, unknown>).name ??
                  (item as Record<string, unknown>).id
              )
            : String(item)
        )
        .join(', ')
    }

    default:
      if (typeof value === 'object') return JSON.stringify(value).slice(0, 120)
      return String(value)
  }
}
