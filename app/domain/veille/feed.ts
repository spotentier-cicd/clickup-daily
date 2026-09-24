import { DateTime } from 'luxon'

/*
| Lecture d'un flux RSS 2.0 ou Atom.
|
| Pas de parseur XML en dépendance : on ne lit que six balises, toujours les
| mêmes, dans des documents produits par des générateurs très conservateurs.
| Un extracteur ciblé tient en cinquante lignes, se teste sans fixture
| gigantesque, et ne fait entrer aucun code tiers dans le domaine.
|
| Ce module est pur : il rend des chaînes. La mise en forme des dates est
| faite ici parce que luxon est une bibliothèque de calcul, pas d'I/O.
*/

export type FeedItem = {
  title: string
  url: string
  summary: string
  publishedAt: DateTime | null
}

/** Les entrées d'un flux, dans l'ordre où le flux les donne. */
export function parseFeed(xml: string, zone: string): FeedItem[] {
  const items: FeedItem[] = []

  for (const [, tag, body] of xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)) {
    const title = text(body, 'title')
    const url = link(body, tag.toLowerCase() === 'entry')
    if (!title || !url) continue

    items.push({
      title,
      url,
      summary:
        text(body, 'description') ||
        text(body, 'summary') ||
        text(body, 'content') ||
        text(body, 'encoded'),
      publishedAt: parseDate(
        raw(body, 'pubDate') || raw(body, 'published') || raw(body, 'updated') || raw(body, 'date'),
        zone
      ),
    })
  }

  return items
}

/**
 * Une date de flux, quel que soit le dialecte.
 *
 * RSS impose le RFC 822, Atom l'ISO 8601, et une partie des générateurs
 * écrivent ce qui leur chante. Les trois lectures sont tentées dans l'ordre
 * du plus probable ; un format inconnu rend `null` plutôt qu'une date fausse.
 */
export function parseDate(value: string, zone: string): DateTime | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const options = { zone, setZone: false }
  for (const date of [
    DateTime.fromISO(trimmed, options),
    DateTime.fromRFC2822(trimmed, options),
    DateTime.fromHTTP(trimmed, options),
  ]) {
    if (date.isValid) return date
  }

  return null
}

/** Le contenu brut d'une balise, CDATA retiré. Le premier trouvé gagne. */
function raw(body: string, name: string): string {
  /* `dc:date` et `date` s'écrivent pareil une fois le préfixe rendu optionnel. */
  const pattern = new RegExp(
    `<(?:[a-z]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[a-z]+:)?${name}>`,
    'i'
  )
  const found = pattern.exec(body)
  if (!found) return ''

  return found[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim()
}

/** Le contenu d'une balise, ramené à du texte lisible. */
function text(body: string, name: string): string {
  return clean(raw(body, name))
}

/**
 * Le lien de l'entrée.
 *
 * Atom le porte en attribut `href` et peut en publier plusieurs — celui qui
 * mène à la page se reconnaît à `rel="alternate"`, ou à l'absence de `rel`.
 * RSS le met dans le corps de la balise, et retombe sur `guid` quand le flux
 * n'a pas de `link` (quelques générateurs GitHub font ça).
 */
function link(body: string, isAtom: boolean): string {
  if (isAtom) {
    for (const [, attributes] of body.matchAll(/<link\b([^>]*)\/?>/gi)) {
      const rel = /\brel\s*=\s*["']([^"']*)["']/i.exec(attributes)?.[1]
      if (rel && rel !== 'alternate') continue

      const href = /\bhref\s*=\s*["']([^"']*)["']/i.exec(attributes)?.[1]
      if (href) return clean(href)
    }
  }

  const inline = text(body, 'link')
  if (inline.startsWith('http')) return inline

  const guid = text(body, 'guid')
  return guid.startsWith('http') ? guid : ''
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
}

/**
 * Entités décodées, balises retirées, blancs réduits : du texte, enfin.
 *
 * Le décodage passe AVANT le retrait des balises : la plupart des flux
 * livrent leur description en HTML échappé (`&lt;p&gt;`), et l'ordre inverse
 * laisserait les balises en clair dans le résumé.
 */
function clean(value: string): string {
  return decode(value)
    .replace(/<[^>]*>/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
}

function decode(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => codePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, digits) => codePoint(Number.parseInt(digits, 10)))
    .replace(/&([a-z]+);/gi, (whole, name) => ENTITIES[name.toLowerCase()] ?? whole)
}

/** Un point de code hors plage ne doit pas faire tomber la collecte entière. */
function codePoint(value: number): string {
  if (!Number.isFinite(value) || value < 0 || value > 0x10ffff) return ''
  return String.fromCodePoint(value)
}
