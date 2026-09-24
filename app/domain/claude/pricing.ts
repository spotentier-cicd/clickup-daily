/*
| LA GRILLE TARIFAIRE.
|
| Relevée sur platform.claude.com/docs/en/about-claude/pricing le 2026-09-24.
| Les prix sont en dollars par million de tokens.
|
| Elle vieillira : un tarif change, un modèle sort. C'est assumé, à deux
| conditions. La première est qu'un modèle absent de la table ne soit jamais
| compté zéro en silence — il ressort dans `unknownModels` et s'affiche.
| La seconde est la commande `claude:usage --verify`, qui confronte notre
| calcul au coût que Claude Code a lui-même inscrit dans ses transcriptions :
| si un prix dérive, l'écart se voit.
|
| Rien ici ne touche au disque ni au réseau : c'est du domaine.
*/

/** Ce qu'une réponse a consommé, une fois la ligne de transcription dépouillée. */
export type TokenUsage = {
  input: number
  output: number
  cacheRead: number
  /** Écriture de cache 5 minutes : 1,25 × le prix d'entrée. */
  cacheWrite5m: number
  /** Écriture de cache 1 heure : 2 × le prix d'entrée. */
  cacheWrite1h: number
  webSearches: number
}

type ModelPrice = {
  input: number
  output: number
  /** Part du prix d'entrée payée sur une lecture de cache. */
  cacheReadRatio: number
  /** Mode rapide : tarifs d'entrée et de sortie qui remplacent les standards. */
  fast?: { input: number; output: number }
}

function price(
  input: number,
  output: number,
  cacheReadRatio = 0.1,
  fast?: { input: number; output: number }
): ModelPrice {
  return { input, output, cacheReadRatio, fast }
}

/** Par identifiant normalisé. */
const PRICES: Record<string, ModelPrice> = {
  'claude-opus-5-5': price(4, 20, 0.05, { input: 8, output: 40 }),
  'claude-opus-5': price(5, 25, 0.1, { input: 10, output: 50 }),
  'claude-opus-4-8': price(5, 25, 0.1, { input: 10, output: 50 }),
  'claude-opus-4-7': price(5, 25),
  'claude-opus-4-6': price(5, 25),
  'claude-opus-4-5': price(5, 25),
  'claude-opus-4-1': price(15, 75),
  'claude-opus-4': price(15, 75),
  'claude-sonnet-5': price(2, 10),
  'claude-sonnet-4-6': price(3, 15),
  'claude-sonnet-4-5': price(3, 15),
  'claude-sonnet-4': price(3, 15),
  'claude-haiku-4-5': price(1, 5),
  'claude-haiku-3-5': price(0.8, 4),
  'claude-fable-5-1': price(10, 50, 0.025),
  'claude-fable-5': price(10, 50),
  'claude-mythos-5-1': price(10, 50, 0.025),
  'claude-mythos-5': price(10, 50),
}

/** 10 $ les mille recherches. */
const WEB_SEARCH_USD = 10 / 1000

/**
 * Les identifiants portent des suffixes que la grille ne connaît pas :
 * `claude-opus-5[1m]` (fenêtre de contexte, sans effet sur le prix) et
 * `claude-haiku-4-5-20251001` (date de version).
 */
export function normalizeModel(model: string): string {
  return model
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, '')
    .replace(/-\d{8}$/, '')
    .trim()
}

/** Les messages fabriqués par le client (erreurs de quota) ne coûtent rien. */
export function isBillable(model: string): boolean {
  return Boolean(model) && !model.startsWith('<')
}

/** Le tarif d'un modèle, ou null s'il est absent de la grille. */
export function priceOf(model: string): ModelPrice | null {
  const key = normalizeModel(model)
  if (PRICES[key]) return PRICES[key]

  /*
   * Une variante inconnue d'un modèle connu (« claude-opus-5-turbo ») vaut
   * mieux tarifée au préfixe le plus long qu'écartée : on préfère un montant
   * approché à un trou dans le total.
   */
  const fallback = Object.keys(PRICES)
    .filter((candidate) => key.startsWith(`${candidate}-`))
    .sort((a, b) => b.length - a.length)[0]

  return fallback ? PRICES[fallback] : null
}

/**
 * Ce qu'aurait coûté cette consommation au tarif de l'API.
 *
 * Null quand le modèle est inconnu : l'appelant le signale plutôt que de
 * l'ajouter comme un zéro.
 */
export function costOf(usage: TokenUsage, model: string, speed?: string): number | null {
  const tariff = priceOf(model)
  if (!tariff) return null

  const fast = speed === 'fast' ? tariff.fast : undefined
  const input = fast?.input ?? tariff.input
  const output = fast?.output ?? tariff.output

  const perMillion =
    usage.input * input +
    usage.output * output +
    usage.cacheRead * input * tariff.cacheReadRatio +
    usage.cacheWrite5m * input * 1.25 +
    usage.cacheWrite1h * input * 2

  return perMillion / 1_000_000 + usage.webSearches * WEB_SEARCH_USD
}

/** Somme de deux relevés, pour agréger sans se répéter. */
export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    cacheRead: a.cacheRead + b.cacheRead,
    cacheWrite5m: a.cacheWrite5m + b.cacheWrite5m,
    cacheWrite1h: a.cacheWrite1h + b.cacheWrite1h,
    webSearches: a.webSearches + b.webSearches,
  }
}

export function emptyUsage(): TokenUsage {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0, webSearches: 0 }
}
