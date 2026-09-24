import db from '@adonisjs/lucid/services/db'
import config from '#config/clickup_daily'
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
   * La référence de comparaison de « ce qui a changé ».
   *
   * D'abord le dernier run PLANIFIÉ : c'est la bonne référence, parce qu'un
   * rafraîchissement manuel ne doit pas la déplacer — on compare au rapport du
   * matin, pas au clic précédent.
   *
   * À défaut, le dernier run d'AVANT AUJOURD'HUI, quel que soit son
   * déclencheur. Sans ce repli, une installation sans planificateur ne produit
   * jamais de référence : `diff.since` reste nul, et l'écran affiche « rien
   * n'a changé » là où il devrait dire « rien à quoi comparer ». C'est le même
   * silence que le reste du projet s'interdit.
   *
   * La comparaison porte sur `day`, une date ISO stockée en texte : l'ordre
   * lexicographique y est l'ordre chronologique, sans question de fuseau.
   */
  async diffReference(now: DateTime): Promise<{ at: DateTime; tasks: TaskSnapshotData[] } | null> {
    const today = now.toISODate()!

    const run =
      (await Run.query().where('trigger', 'scheduled').orderBy('ran_at', 'desc').first()) ??
      (await Run.query().where('day', '<', today).orderBy('ran_at', 'desc').first())

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

  /**
   * Le rapport sérialisé d'un run, prêt à partir en props Inertia.
   *
   * Les archives sont relues longtemps après avoir été écrites : un rapport
   * enregistré avant l'ajout d'un champ au contrat n'en a pas. On complète donc
   * à la lecture plutôt que de laisser l'affichage planter sur une archive — ce
   * qui viderait l'écran sans rien expliquer.
   */
  payloadOf(run: Run): ReportDto {
    const brut = JSON.parse(run.payload) as Partial<ReportDto>

    return {
      ...brut,
      /*
       * `listId` est arrivé avec le périmètre par listes. Une archive plus
       * ancienne n'en a pas, et on ne peut pas le deviner : on pose la chaîne
       * vide, qui veut dire « inconnu ». Le filtre laisse alors passer la
       * tâche — sinon rouvrir le rapport de la semaine dernière donnerait un
       * écran vide.
       */
      tasks: (brut.tasks ?? []).map((task) => ({
        ...task,
        listId: task.listId ?? '',
        folderId: task.folderId ?? '',
      })),
      veille: brut.veille ?? null,
      claude: brut.claude ?? null,
      comments: brut.comments ?? {},
      branches: brut.branches ?? {},
      mentions: brut.mentions ?? [],
      blockers: brut.blockers ?? [],
      pointage: brut.pointage ?? null,
      thresholds: brut.thresholds ?? {
        staleAfterDays: config.staleAfterDays,
        reviewWaitDays: config.blockers.reviewWaitDays,
        recetteWaitDays: config.blockers.recetteWaitDays,
        targetHoursPerDay: config.temps.targetHoursPerDay,
        mentionsLookbackDays: config.mentions.lookbackDays,
      },
    } as ReportDto
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
