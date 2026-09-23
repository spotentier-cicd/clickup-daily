/*
| Utilitaires de texte du domaine. Purs, sans I/O.
*/

/**
 * Minuscules, sans accents, espaces multiples réduits — pour comparer des
 * statuts. Les statuts de ce workspace sont saisis sans accents (« a faire »,
 * « deployé sur recette »), donc toute comparaison passe par ici.
 */
export function normalize(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
}

/**
 * Mots-clés présents comme mots entiers dans un texte.
 *
 * « Express » ne remonte pas « expressed », « Vite » ne remonte pas « invite ».
 * Un mot-clé terminé par `*` accepte un suffixe : « deprecat* » attrape
 * deprecated, « PHP 8* » attrape PHP 8.4.
 *
 * Renvoie le libellé réellement trouvé, suffixe compris : le mot-clé
 * « Laravel 1* » ressort en « Laravel 14 ».
 */
export function findHighlights(haystack: string, keywords: string[]): string[] {
  const hay = normalize(haystack)
  const found: string[] = []

  for (const keyword of keywords) {
    const allowsSuffix = keyword.endsWith('*')
    const stem = normalize(keyword.replace(/\*+$/, ''))
    if (!stem) continue

    const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = allowsSuffix ? `${escaped}[a-z0-9.]*` : `${escaped}(?![a-z0-9])`
    const match = new RegExp(`(?<![a-z0-9])${pattern}`).exec(hay)

    if (match) {
      found.push(keyword.replace(/\*+$/, '') + match[0].slice(stem.length))
    }
  }

  return found
}
