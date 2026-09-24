import type { JSONDataTypes } from '@adonisjs/core/types/transformers'
import type { ReportDto } from '#domain/report'
import type { FieldUsage, ProjectCatalog, ProjectPreferences } from '#domain/projects'

/*
| Garde-fou : tout ce qui part en props Inertia doit être du JSON pour AdonisJS.
|
| Piège non évident : `JSONDataTypes` exige une signature d'index, et
| TypeScript n'en donne PAS aux `interface` — seulement aux alias de `type`.
| Une interface qui traverse vers les props fait donc échouer la contrainte
| `Props extends ComponentProps`, et l'erreur qu'on obtient alors n'est pas
| « votre type n'est pas du JSON » mais un « paramètre de type never » sur
| l'appel à inertia.render, à l'autre bout de la chaîne.
|
| D'où la règle : un type qui traverse vers le client se déclare en `type`.
| Les lignes ci-dessous la font respecter avec un message compréhensible.
*/

type DoitEtreDuJson<T extends JSONDataTypes> = T

export type VerificationRapport = DoitEtreDuJson<ReportDto>
export type VerificationCatalogue = DoitEtreDuJson<ProjectCatalog>
export type VerificationPreferences = DoitEtreDuJson<ProjectPreferences>
export type VerificationChamps = DoitEtreDuJson<FieldUsage[]>
