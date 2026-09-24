import type { SerializedReport } from '#domain/report_serializer'

/*
| Le contrat, vu du navigateur.
|
| Les types viennent du domaine : si une règle change côté serveur, le
| typecheck du front casse. C'est voulu — c'est ce qui garantit qu'il n'y a
| qu'une définition du rapport dans le projet.
*/
export type Report = SerializedReport
export type Task = Report['tasks'][number]
export type Blocker = Report['blockers'][number]
export type Pointage = NonNullable<Report['pointage']>
export type PointageDay = Pointage['days'][number]
export type ReportColumn = Report['columns'][number]
export type Mention = Report['mentions'][number]
export type Branch = Report['branches'][string][number]
export type Comment = Report['comments'][string][number]
