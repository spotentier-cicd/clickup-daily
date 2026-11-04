import ClickupCacheEntry from '#models/clickup_cache_entry'
import type { DateTime } from 'luxon'
import type { RawComment } from '#domain/mention/comments'

/*
| LE CACHE DES LECTURES À L'UNITÉ.
|
| ClickUp plafonne à 100 appels par minute, et deux lectures du rapport coûtent
| un appel PAR TÂCHE : les commentaires, et le statut d'une tâche sortie du
| périmètre. Une centaine de tâches balayées à chaque « Rafraîchir », c'est le
| quota entier — et une minute d'attente que la fenêtre se rouvre.
|
| L'idée : ne relire que ce qui a pu changer. Un commentaire fait avancer la
| date de modification de sa tâche (vérifié sur l'API : la date de la tâche
| coïncide avec celle de son dernier commentaire). Une tâche dont la date n'a
| pas bougé depuis la dernière lecture n'a donc rien de neuf à dire — c'est
| cette date qui sert d'estampille.
|
| L'estampille ne voit pas tout : un commentaire résolu ou corrigé ne fait pas
| forcément bouger la tâche. D'où une relecture passé un délai, que l'appelant
| étale par petits lots pour ne jamais retomber dans le quota.
*/

/** Passé ce délai, une entrée encore valable mérite d'être relue à l'occasion. */
export const REVALIDATE_AFTER_HOURS = 12

export interface CachedComments {
  comments: RawComment[]
  fetchedAt: DateTime
}

export interface CachedStatus {
  status: string
  fetchedAt: DateTime
}

const COMMENTS = 'comments:'
const STATUS = 'status:'

export class ClickupCacheRepository {
  /**
   * Les commentaires connus des tâches données, à condition que la tâche
   * n'ait pas bougé depuis : une estampille différente est un cache périmé,
   * et l'entrée est tue comme si elle n'existait pas.
   */
  async comments(tasks: { id: string; stamp: string }[]): Promise<Map<string, CachedComments>> {
    const stamps = new Map(tasks.map((task) => [task.id, task.stamp]))
    const found = new Map<string, CachedComments>()

    for (const row of await this.#rows(tasks.map((task) => COMMENTS + task.id))) {
      const id = row.key.slice(COMMENTS.length)
      if (row.stamp !== stamps.get(id)) continue
      found.set(id, { comments: parse<RawComment[]>(row.payload, []), fetchedAt: row.fetchedAt })
    }

    return found
  }

  async rememberComments(
    entries: { id: string; stamp: string; comments: RawComment[] }[],
    now: DateTime
  ): Promise<void> {
    await this.#write(
      entries.map((entry) => ({
        key: COMMENTS + entry.id,
        stamp: entry.stamp,
        payload: JSON.stringify(entry.comments),
        fetchedAt: now,
      }))
    )
  }

  /** Le dernier statut lu des tâches données, avec la date de cette lecture. */
  async exitStatuses(taskIds: string[]): Promise<Map<string, CachedStatus>> {
    const found = new Map<string, CachedStatus>()

    for (const row of await this.#rows(taskIds.map((id) => STATUS + id))) {
      const status = parse<string>(row.payload, '')
      if (!status) continue
      found.set(row.key.slice(STATUS.length), { status, fetchedAt: row.fetchedAt })
    }

    return found
  }

  async rememberExitStatuses(
    entries: { id: string; status: string }[],
    now: DateTime
  ): Promise<void> {
    await this.#write(
      entries.map((entry) => ({
        key: STATUS + entry.id,
        stamp: '',
        payload: JSON.stringify(entry.status),
        fetchedAt: now,
      }))
    )
  }

  /**
   * Oublie ce qui n'a pas été relu depuis la rétention. Une tâche sortie du
   * périmètre depuis un mois ne reviendra pas dans « ce qui a changé ».
   */
  async purge(keepDays: number, now: DateTime): Promise<void> {
    const horizon = now.minus({ days: keepDays })
    await ClickupCacheEntry.query().where('fetched_at', '<', horizon.toSQL()!).delete()
  }

  async #rows(keys: string[]): Promise<ClickupCacheEntry[]> {
    if (keys.length === 0) return []
    return ClickupCacheEntry.query().whereIn('key', keys)
  }

  async #write(
    rows: { key: string; stamp: string; payload: string; fetchedAt: DateTime }[]
  ): Promise<void> {
    if (rows.length === 0) return
    await ClickupCacheEntry.updateOrCreateMany('key', rows)
  }
}

/** Une entrée illisible vaut une entrée absente : on relira, c'est tout. */
function parse<T>(payload: string, fallback: T): T {
  try {
    return JSON.parse(payload) as T
  } catch {
    return fallback
  }
}
