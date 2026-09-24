import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { parseFeed } from '#domain/veille/feed'
import { buildVeille } from '#domain/veille/select'
import type { VeilleConfig } from '#domain/config/types'

const ZONE = 'Europe/Paris'
const NOW = DateTime.fromISO('2026-09-24T10:00:00', { zone: ZONE })

const RSS = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Laravel News</title>
    <item>
      <title><![CDATA[Laravel 13 : les changements cassants]]></title>
      <link>https://laravel-news.com/laravel-13?utm_source=rss</link>
      <description>&lt;p&gt;Tour des   d&#233;pr&#233;ciations et du nouveau squelette.&lt;/p&gt;</description>
      <pubDate>Tue, 22 Sep 2026 08:30:00 +0000</pubDate>
    </item>
    <item>
      <title>Laravel 13.1.0-rc.2 disponible</title>
      <link>https://laravel-news.com/rc</link>
      <description>Une release candidate.</description>
      <pubDate>Wed, 23 Sep 2026 08:30:00 +0000</pubDate>
    </item>
    <item>
      <title>Un vieil article</title>
      <link>https://laravel-news.com/vieux</link>
      <description>Hors fenêtre.</description>
      <pubDate>Mon, 01 Jun 2026 08:30:00 +0000</pubDate>
    </item>
  </channel>
</rss>`

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>claude-code releases</title>
  <entry>
    <title>v2.4.0</title>
    <link rel="edit" href="https://api.example.com/edit/1"/>
    <link rel="alternate" href="https://github.com/anthropics/claude-code/releases/tag/v2.4.0"/>
    <updated>2026-09-23T14:05:00Z</updated>
    <content type="html">Hooks de pr&#233;-commit et sous-agents parall&#232;les.</content>
  </entry>
</feed>`

function config(overrides: Partial<VeilleConfig> = {}): VeilleConfig {
  return {
    enabled: true,
    maxAgeDays: 10,
    perSource: 5,
    maxItems: 80,
    timeoutSeconds: 10,
    cacheHours: 6,
    excludeTitle: ['alpha', 'beta', '-rc', 'canary'],
    highlight: ['Laravel 1*', 'Claude Code', 'deprecat*'],
    groups: [
      { key: 'ia', label: 'IA & agents' },
      { key: 'laravel', label: 'Laravel & PHP' },
    ],
    sources: [],
    ...overrides,
  }
}

test.group('Veille — lecture des flux', () => {
  test('lit un flux RSS, CDATA et entités comprises', ({ assert }) => {
    const items = parseFeed(RSS, ZONE)

    assert.lengthOf(items, 3)
    assert.equal(items[0].title, 'Laravel 13 : les changements cassants')
    assert.equal(items[0].url, 'https://laravel-news.com/laravel-13?utm_source=rss')
    assert.equal(items[0].summary, 'Tour des dépréciations et du nouveau squelette.')
    assert.equal(items[0].publishedAt?.toUTC().toISO(), '2026-09-22T08:30:00.000Z')
  })

  test('préfère le lien alternate d’une entrée Atom', ({ assert }) => {
    const items = parseFeed(ATOM, ZONE)

    assert.lengthOf(items, 1)
    assert.equal(items[0].url, 'https://github.com/anthropics/claude-code/releases/tag/v2.4.0')
    assert.equal(items[0].summary, 'Hooks de pré-commit et sous-agents parallèles.')
  })

  test('un flux illisible ne rend rien plutôt que du bruit', ({ assert }) => {
    assert.isEmpty(parseFeed('<html><body>404</body></html>', ZONE))
  })
})

test.group('Veille — sélection', () => {
  const feeds = [
    { source: { label: 'Laravel News', group: 'laravel' }, items: parseFeed(RSS, ZONE) },
    { source: { label: 'Claude Code', group: 'ia' }, items: parseFeed(ATOM, ZONE) },
  ]

  test('écarte les préversions et ce qui sort de la fenêtre', ({ assert }) => {
    const veille = buildVeille({ feeds, config: config(), now: NOW, since: null })
    const titres = veille.articles.map((article) => article.title)

    assert.notInclude(titres, 'Laravel 13.1.0-rc.2 disponible')
    assert.notInclude(titres, 'Un vieil article')
    assert.lengthOf(veille.articles, 2)
  })

  test('trie du plus récent au plus ancien et marque les mots-clés', ({ assert }) => {
    const veille = buildVeille({ feeds, config: config(), now: NOW, since: null })

    assert.equal(veille.articles[0].title, 'v2.4.0')
    assert.deepEqual(veille.articles[0].highlights, ['Claude Code'])
    assert.deepEqual(veille.articles[1].highlights, ['Laravel 13'])
  })

  test('est nouveau ce qui est paru depuis le rapport de référence', ({ assert }) => {
    const since = DateTime.fromISO('2026-09-23T08:00:00Z', { zone: ZONE })
    const veille = buildVeille({ feeds, config: config(), now: NOW, since })

    assert.deepEqual(
      veille.articles.map((article) => article.isNew),
      [true, false]
    )
  })

  test('deux flux qui relaient la même page ne la comptent qu’une fois', ({ assert }) => {
    const relay = {
      source: { label: 'Laravel blog', group: 'laravel' },
      items: parseFeed(RSS.replace('?utm_source=rss', '/'), ZONE),
    }
    const veille = buildVeille({
      feeds: [...feeds, relay],
      config: config(),
      now: NOW,
      since: null,
    })

    assert.lengthOf(veille.articles, 2)
    assert.equal(veille.sources.at(-1)?.kept, 0)
  })

  test('un flux injoignable se dit au lieu de disparaître', ({ assert }) => {
    const veille = buildVeille({
      feeds: [{ source: { label: 'Latent Space', group: 'ia' }, items: null }],
      config: config(),
      now: NOW,
      since: null,
    })

    assert.deepEqual(veille.sources, [
      { label: 'Latent Space', group: 'ia', reachable: false, kept: 0 },
    ])
  })

  test('le quota par source borne un flux bavard', ({ assert }) => {
    const veille = buildVeille({ feeds, config: config({ perSource: 1 }), now: NOW, since: null })

    assert.lengthOf(veille.articles, 2)
    assert.equal(veille.sources[0].kept, 1)
  })
})
