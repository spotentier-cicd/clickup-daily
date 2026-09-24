import { DateTime } from 'luxon'
import type { Report } from '#domain/report'

/*
| Un seul format sérialisé, pour deux usages : ce qu'on stocke en base et ce
| qu'on passe en props à React. Les deux doivent être du JSON, et il n'y a donc
| aucune raison d'avoir deux conversions à garder d'accord.
|
| Les DateTime de Luxon deviennent des chaînes ISO ; tout le reste est déjà du
| JSON.
*/
export type Serialized<T> = T extends DateTime
  ? string
  : T extends (infer U)[]
    ? Serialized<U>[]
    : T extends object
      ? { [K in keyof T]: Serialized<T[K]> }
      : T

export type SerializedReport = Serialized<Report>

export function serializeReport(report: Report): SerializedReport {
  return serialize(report) as SerializedReport
}

function serialize(value: unknown): unknown {
  if (value instanceof DateTime) return value.toISO()
  if (Array.isArray(value)) return value.map(serialize)

  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]))
  }

  return value
}
