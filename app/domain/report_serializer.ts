import { DateTime } from 'luxon'
import type { Report, ReportDto } from '#domain/report'

/*
| Un seul format sérialisé, pour deux usages : ce qu'on stocke en base et ce
| qu'on passe en props à React.
|
| Le type d'arrivée n'est pas déduit par un type conditionnel récursif mais
| déclaré : ReportDto, c'est ReportOf<string>. Le compilateur n'a donc rien à
| recalculer à chaque endroit où le rapport traverse une frontière — et une
| version dérivée coûtait assez cher pour faire capituler l'inférence des props
| d'Inertia.
*/
export function serializeReport(report: Report): ReportDto {
  return serialize(report) as ReportDto
}

function serialize(value: unknown): unknown {
  if (value instanceof DateTime) return value.toISO()
  if (Array.isArray(value)) return value.map(serialize)

  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]))
  }

  return value
}
