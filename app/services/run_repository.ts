import db from '@adonisjs/lucid/services/db'
import { type DateTime } from 'luxon'
import Run from '#models/run'
import TaskSnapshot from '#models/task_snapshot'
import { serializeReport } from '#domain/report_serializer'
import type { Report } from '#domain/report'
import type { TaskSnapshot as TaskSnapshotData } from '#domain/rules/diff'
import type { ReportDto } from '#domain/report'

/** Ce qui a déclenché la collecte. */
export type RunTrigger = 'scheduled' | 'manual' | 'refresh'

/**
 * Lecture et écriture des runs.
 *
 * La v1 gardait un unique instantané dans reports/latest.json, écrasé chaque
 * matin. Ici chaque collecte est conservée : on peut réafficher un rapport
 * passé et comparer dans le temps.
 */
export class RunRepository {
  /** Enregistre un rapport et ses instantanés de tâches, tout ou rien. */
  async save(report: Report, trigger: RunTrigger): Promise<Run> {
    return db.transaction(async (trx) => {
      const run = await Run.create(
        {
          ranAt: report.generatedAt,
          day: report.generatedAt.toISODate()!,
          trigger,
          durationMs: report.stats.durationMs,
          apiCalls: report.stats.apiCalls,
          totalTasks: report.stats.total,
          myTasks: report.stats.mine,
          bugTasks: report.stats.bugs,
          backlogExcluded: report.stats.backlogExcluded,
          blockers: report.blockers.length,
          weekMs: report.pointage?.weekMs ?? 0,
          payload: JSON.stringify(serializeReport(report)),
        },
        { client: trx }
      )

      if (report.tasks.length) {
        await TaskSnapshot.createMany(
          report.tasks.map((task) => ({
            runId: run.id,
            taskId: task.id,
            ref: task.ref,
            name: task.name,
            url: task.url,
            envKey: task.envKey,
            status: task.status,
            columnKey: task.column,
            assigneeIds: JSON.stringify(task.assigneeIds),
            isMine: task.isMine,
            isBug: task.isBug,
            timeEstimateMs: task.timeEstimateMs,
            timeSpentMs: task.timeSpentMs,
            myTimeMs: task.myTimeMs,
          })),
          { client: trx }
        )
      }

      return run
    })
  }

  /** Le run le plus récent, tous déclencheurs confondus. */
  async latest(): Promise<Run | null> {
    return Run.query().orderBy('ran_at', 'desc').first()
  }

  /** Le run d'une journée donnée, le plus récent de cette journée. */
  async forDay(day: string): Promise<Run | null> {
    return Run.query().where('day', day).orderBy('ran_at', 'desc').first()
  }

  /**
   * La référence de comparaison : le dernier run planifié.
   *
   * Un rafraîchissement manuel ne la déplace pas — « ce qui a changé » continue
   * de se comparer au rapport du matin, pas au clic précédent.
   */
  async diffReference(
    before?: DateTime
  ): Promise<{ at: DateTime; tasks: TaskSnapshotData[] } | null> {
    const query = Run.query().where('trigger', 'scheduled').orderBy('ran_at', 'desc')
    if (before) query.where('ran_at', '<', before.toSQL()!)

    const run = await query.first()
    if (!run) return null

    const snapshots = await TaskSnapshot.query().where('run_id', run.id)

    return {
      at: run.ranAt,
      tasks: snapshots.map((snapshot) => ({
        id: snapshot.taskId,
        ref: snapshot.ref,
        name: snapshot.name,
        url: snapshot.url,
        envKey: snapshot.envKey,
        status: snapshot.status,
        column: snapshot.columnKey,
        assigneeIds: JSON.parse(snapshot.assigneeIds) as number[],
      })),
    }
  }

  /** Le rapport sérialisé d'un run, prêt à partir en props Inertia. */
  payloadOf(run: Run): ReportDto {
    return JSON.parse(run.payload) as ReportDto
  }

  /** Les journées disponibles, de la plus récente à la plus ancienne. */
  async availableDays(limit = 60): Promise<{ day: string; ranAt: string }[]> {
    const runs = await Run.query()
      .select('day')
      .max('ran_at as ran_at')
      .groupBy('day')
      .orderBy('day', 'desc')
      .limit(limit)

    return runs.map((run) => ({ day: run.day, ranAt: run.ranAt.toISO()! }))
  }

  /** Supprime les runs plus vieux que la rétention ; les instantanés suivent. */
  async purge(keepDays: number, now: DateTime): Promise<number> {
    const horizon = now.minus({ days: keepDays }).startOf('day')
    return Run.query()
      .where('ran_at', '<', horizon.toSQL()!)
      .delete()
      .then(() => 0)
  }
}
