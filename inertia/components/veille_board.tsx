import { Plugs, StarFour } from '@phosphor-icons/react'
import { CARD, KICKER } from '@/lib/styles'
import { daysSince, formatAge } from '@/lib/format'
import type { Veille, VeilleArticle } from '@/lib/report'

/*
| LA VEILLE.
|
| Deux niveaux de lecture, et c'est voulu : « Pour nous » d'abord — les
| articles où un de nos mots-clés apparaît, donc ceux qui peuvent coûter cher
| à ignorer — puis le tout-venant, rangé par famille.
|
| Un flux injoignable se dit en toutes lettres. Un silence ne doit jamais
| pouvoir passer pour une absence de nouvelles.
*/

interface VeilleBoardProps {
  veille: Veille
  /** Articles déjà passés à la recherche. */
  articles: VeilleArticle[]
  generatedAt: string
}

export function VeilleBoard({ veille, articles, generatedAt }: VeilleBoardProps) {
  const forUs = articles.filter((article) => article.highlights.length > 0).slice(0, 12)
  const unreachable = veille.sources.filter((source) => !source.reachable)
  const groups = veille.groups
    .map((group) => ({
      ...group,
      items: articles.filter((article) => article.group === group.key),
    }))
    .filter((group) => group.items.length > 0)

  if (articles.length === 0) {
    return (
      <div
        className="py-16 text-center"
        style={{ font: '400 14px var(--font-body)', color: 'var(--muted)' }}
      >
        Aucun article ne correspond à la recherche.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {forUs.length > 0 && (
        <section
          className="overflow-hidden"
          style={{
            background: 'var(--color-surface)',
            borderRadius: 8,
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div className="h-[2px]" style={{ background: 'var(--color-accent)' }} />
          <div className="flex flex-col gap-3 px-[18px] pt-4 pb-[18px]">
            <div
              className="flex items-center gap-2"
              style={{ ...KICKER, color: 'var(--color-accent)' }}
            >
              <StarFour size={15} />
              Pour nous
              <span
                style={{
                  font: '400 12.5px var(--font-body)',
                  letterSpacing: 0,
                  textTransform: 'none',
                  color: 'var(--muted)',
                }}
              >
                — articles qui citent notre stack
              </span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-x-7 gap-y-3">
              {forUs.map((article) => (
                <div key={article.id} className="flex flex-col gap-[5px]">
                  <div
                    className="flex flex-wrap items-center gap-[5px]"
                    style={{ font: '400 11.5px var(--font-body)', color: 'var(--muted)' }}
                  >
                    {article.source}
                    {article.highlights.map((keyword) => (
                      <Keyword key={keyword} text={keyword} />
                    ))}
                  </div>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ font: '500 14px/1.38 var(--font-body)', textWrap: 'pretty' }}
                  >
                    {article.title}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <div
        className="flex flex-wrap items-center gap-x-[18px] gap-y-[6px]"
        style={{ font: '400 13px var(--font-body)', color: 'var(--muted)' }}
      >
        <Stat value={articles.length} label="articles" />
        <Stat value={new Set(articles.map((article) => article.source)).size} label="sources" />
        <Stat value={articles.filter((article) => article.isNew).length} label="nouveautés" />
        <span>
          fenêtre de{' '}
          <strong style={{ color: 'var(--color-text)', fontWeight: 500 }}>
            {veille.lookbackDays} jours
          </strong>
        </span>
        {unreachable.length > 0 && (
          <span className="flex items-center gap-[5px]" style={{ color: 'var(--amber)' }}>
            <Plugs size={14} />
            injoignable{unreachable.length > 1 ? 's' : ''} :{' '}
            {unreachable.map((source) => source.label).join(', ')}
          </span>
        )}
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,330px),1fr))] items-start gap-[18px]">
        {groups.map((group) => (
          <div key={group.key} className="flex flex-col gap-[10px]">
            <div className="flex items-center gap-2 px-[2px] pb-[2px]">
              <span style={{ font: '500 13.5px var(--font-body)' }}>{group.label}</span>
              <span className="num" style={{ font: '500 12px var(--mono)', color: 'var(--faint)' }}>
                {group.items.length}
              </span>
            </div>

            {group.items.map((article) => (
              <article
                key={article.id}
                style={{ ...CARD, padding: '12px 14px' }}
                className="flex flex-col gap-[7px]"
              >
                <div
                  className="flex flex-wrap items-center gap-[6px]"
                  style={{ font: '400 11.5px var(--font-body)', color: 'var(--muted)' }}
                >
                  {article.source} · {formatAge(daysSince(article.publishedAt, generatedAt))}
                  {article.isNew && (
                    <span className="tag tag-accent" style={{ padding: '2px 7px', fontSize: 10.5 }}>
                      nouveau
                    </span>
                  )}
                </div>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ font: '500 14px/1.38 var(--font-body)', textWrap: 'pretty' }}
                >
                  {article.title}
                </a>
                {article.highlights.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {article.highlights.map((keyword) => (
                      <Keyword key={keyword} text={keyword} />
                    ))}
                  </div>
                )}
                {article.summary && (
                  <details style={{ font: '400 12.5px/1.5 var(--font-body)' }}>
                    <summary style={{ color: 'var(--muted)', fontWeight: 500 }}>Résumé</summary>
                    <p
                      className="mt-[6px] mb-0"
                      style={{
                        textWrap: 'pretty',
                        color: 'color-mix(in srgb, var(--color-text) 85%, transparent)',
                      }}
                    >
                      {article.summary}
                    </p>
                  </details>
                )}
              </article>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function Keyword({ text }: { text: string }) {
  return (
    <span
      style={{
        font: '500 10.5px/1 var(--mono)',
        padding: '3px 5px',
        borderRadius: 4,
        background: 'var(--tint)',
        color: 'var(--tint-ink)',
      }}
    >
      {text}
    </span>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <span>
      <strong className="num" style={{ color: 'var(--color-text)', fontWeight: 500 }}>
        {value}
      </strong>{' '}
      {label}
    </span>
  )
}
