import { ClickUpError } from '#clickup/errors'
import { RateLimiter, sleep } from '#clickup/rate_limiter'
import type { RawTask } from '#domain/task/types'
import type { RawComment } from '#domain/mention/comments'
import type { RawTimeEntry } from '#domain/rules/pointage'

const API_BASE = 'https://api.clickup.com/api/v2'

export interface ClickUpClientOptions {
  token: string
  maxPerMinute?: number
  timeoutMs?: number
  retries?: number
  logger?: {
    debug: (message: string) => void
    info: (message: string) => void
    warn: (message: string) => void
  }
}

/**
 * Client REST v2 minimaliste : limitation de débit, réessais et pagination.
 *
 * N'expose que des lectures. La seule écriture que le projet s'autorise est la
 * saisie des temps, et elle passe ailleurs.
 */
export class ClickUpClient {
  readonly limiter: RateLimiter
  readonly #token: string
  readonly #timeoutMs: number
  readonly #retries: number
  readonly #logger: NonNullable<ClickUpClientOptions['logger']>

  constructor(options: ClickUpClientOptions) {
    this.#token = options.token
    this.#timeoutMs = options.timeoutMs ?? 60_000
    this.#retries = options.retries ?? 4
    this.#logger = options.logger ?? { debug: () => {}, info: () => {}, warn: () => {} }
    this.limiter = new RateLimiter(options.maxPerMinute ?? 90, (seconds) =>
      this.#logger.info(`Limite de débit préventive : pause ${seconds} s`)
    )
  }

  get requestCount(): number {
    return this.limiter.total
  }

  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const url = API_BASE + path + encodeParams(params)
    let lastError: unknown = null

    for (let attempt = 1; attempt <= this.#retries; attempt++) {
      await this.limiter.acquire()

      let response: Response
      try {
        response = await fetch(url, {
          headers: {
            'Authorization': this.#token,
            'Accept': 'application/json',
            'User-Agent': 'clickup-daily/2.0',
          },
          signal: AbortSignal.timeout(this.#timeoutMs),
        })
      } catch (error) {
        lastError = error
        this.#logger.warn(
          `Erreur réseau sur ${path} (${describe(error)}) — nouvel essai dans ${2 ** attempt} s`
        )
        await sleep(2 ** attempt * 1000)
        continue
      }

      if (response.ok) return (await response.json()) as T

      /* Un token refusé ne se répare pas en réessayant. */
      if (response.status === 401) {
        throw new ClickUpError(
          'Token ClickUp refusé (401). Vérifiez CLICKUP_API_TOKEN dans .env.',
          401
        )
      }

      if (response.status === 429) {
        const wait = Number.parseInt(response.headers.get('Retry-After') ?? '60', 10) || 60
        this.#logger.warn(
          `429 rate limit — pause ${wait} s (tentative ${attempt}/${this.#retries})`
        )
        await sleep(wait * 1000)
        lastError = new ClickUpError(`HTTP 429 sur ${path}`, 429)
        continue
      }

      if (response.status >= 500) {
        this.#logger.warn(
          `HTTP ${response.status} sur ${path} — nouvel essai dans ${2 ** attempt} s`
        )
        await sleep(2 ** attempt * 1000)
        lastError = new ClickUpError(`HTTP ${response.status} sur ${path}`, response.status)
        continue
      }

      const text = await response.text().catch(() => '')
      const body = text.slice(0, 300)
      throw new ClickUpError(`HTTP ${response.status} sur ${path} : ${body}`, response.status)
    }

    throw new ClickUpError(
      `Échec après ${this.#retries} tentatives sur ${path} : ${describe(lastError)}`
    )
  }

  async me(): Promise<{ id?: number; username?: string }> {
    const data = await this.get<{ user?: { id?: number; username?: string } }>('/user')
    return data.user ?? {}
  }

  /** Identifiant → nom des types de tâches personnalisés (User Story, Bug, EPIC…). */
  async customItemTypes(teamId: string): Promise<Map<number, string>> {
    try {
      const data = await this.get<{ custom_items?: { id?: number; name?: string }[] }>(
        `/team/${teamId}/custom_item`
      )
      const types = new Map<number, string>()
      for (const item of data.custom_items ?? []) {
        if (item.id !== null && item.id !== undefined)
          types.set(Number(item.id), String(item.name ?? ''))
      }
      return types
    } catch (error) {
      this.#logger.warn(`Types de tâches indisponibles : ${describe(error)}`)
      return new Map()
    }
  }

  /** Toutes les tâches d'un espace dans les statuts donnés, pagination comprise. */
  async teamTasks(teamId: string, spaceId: string, statuses: string[]): Promise<RawTask[]> {
    const tasks: RawTask[] = []

    for (let page = 0; page <= 50; page++) {
      const data = await this.get<{ tasks?: RawTask[]; last_page?: boolean }>(
        `/team/${teamId}/task`,
        {
          space_ids: [spaceId],
          statuses,
          subtasks: true,
          include_closed: true,
          order_by: 'updated',
          page,
        }
      )

      const batch = data.tasks ?? []
      tasks.push(...batch)
      this.#logger.debug(`espace ${spaceId} page ${page} : ${batch.length} tâches`)

      if (data.last_page !== false || batch.length === 0) return tasks

      if (page === 50) {
        this.#logger.warn(`Pagination interrompue à 50 pages pour l'espace ${spaceId}`)
      }
    }

    return tasks
  }

  async task(taskId: string): Promise<RawTask> {
    return this.get<RawTask>(`/task/${taskId}`, { include_subtasks: true })
  }

  async comments(taskId: string): Promise<RawComment[]> {
    const data = await this.get<{ comments?: RawComment[] }>(`/task/${taskId}/comment`)
    return data.comments ?? []
  }

  /** Mes entrées de temps sur la période : l'API rend celles du porteur du jeton. */
  async timeEntries(teamId: string, startMs: number, endMs: number): Promise<RawTimeEntry[]> {
    const data = await this.get<{ data?: RawTimeEntry[] }>(`/team/${teamId}/time_entries`, {
      start_date: startMs,
      end_date: endMs,
    })
    return data.data ?? []
  }
}

/** Les listes partent en `clé[]=valeur`, comme l'attend l'API v2. */
function encodeParams(params?: Record<string, unknown>): string {
  if (!params) return ''

  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue

    if (Array.isArray(value)) {
      for (const item of value) search.append(`${key}[]`, String(item))
    } else if (typeof value === 'boolean') {
      search.append(key, value ? 'true' : 'false')
    } else {
      search.append(key, String(value))
    }
  }

  const query = search.toString()
  return query ? `?${query}` : ''
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
