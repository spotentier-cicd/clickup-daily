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

/**
 * Abrège des libellés de colonnes en gardant chacun distinct.
 *
 * « Revue de code à faire » et « Revue code OK » commencent tous deux par
 * « Revue » : tronquer au premier mot produirait deux étiquettes identiques
 * avec deux compteurs différents, ce qui est pire que long. On ajoute donc des
 * mots jusqu'à ce que chaque abréviation soit unique, et on saute les mots
 * trop courts pour porter du sens.
 */
export function shortLabels(labels: string[]): Map<string, string> {
  const resultat = new Map<string, string>()

  for (const label of labels) {
    const mots = label.split(/\s+/).filter(Boolean)
    let court = label

    for (let n = 1; n <= mots.length; n++) {
      const candidat = mots.slice(0, n).join(' ')
      if (candidat.length < 3) continue

      /* Ne pas s'arrêter sur un mot vide : « Revue de » se lit mal, « Revue de code » non. */
      if (mots[n - 1].length < 3 && n < mots.length) continue

      const unique = labels.every((autre) => autre === label || !autre.startsWith(candidat))
      if (unique || n === mots.length) {
        court = candidat
        break
      }
    }

    resultat.set(label, court)
  }

  return resultat
}
