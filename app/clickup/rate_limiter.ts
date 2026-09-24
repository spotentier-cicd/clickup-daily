/*
| Limiteur de débit préventif, partagé par tous les appels.
|
| ClickUp plafonne à 100 appels par minute. La v1 était séquentielle, donc un
| compteur suffisait ; ici les espaces et les commentaires partent en parallèle,
| et la comptabilité doit être sérialisée — sinon deux appels simultanés
| passeraient tous les deux le même contrôle.
*/
export class RateLimiter {
  #windowStart = Date.now()
  #count = 0
  #chain: Promise<void> = Promise.resolve()
  #total = 0

  constructor(
    private readonly maxPerMinute = 90,
    private readonly onWait?: (seconds: number) => void
  ) {}

  /** Nombre d'appels autorisés depuis le début. */
  get total(): number {
    return this.#total
  }

  /** Attend, si nécessaire, qu'un appel puisse partir sans dépasser le quota. */
  acquire(): Promise<void> {
    const next = this.#chain.then(() => this.#reserve())
    this.#chain = next.catch(() => {})
    return next
  }

  async #reserve(): Promise<void> {
    const now = Date.now()
    if (now - this.#windowStart >= 60_000) {
      this.#windowStart = now
      this.#count = 0
    }

    if (this.#count >= this.maxPerMinute) {
      const wait = Math.max(1_000, 60_000 - (now - this.#windowStart) + 1_000)
      this.onWait?.(Math.round(wait / 1000))
      await sleep(wait)
      this.#windowStart = Date.now()
      this.#count = 0
    }

    this.#count++
    this.#total++
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Applique une fonction à une liste avec un parallélisme borné, en conservant
 * l'ordre des résultats.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0

  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await fn(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}
