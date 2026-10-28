import { useEffect, useRef, useState } from 'react'
import { CaretRight, CaretUpDown } from '@phosphor-icons/react'
import { cn } from 'cn'
import { softOf, type AppModule, type ModulePage } from '@/lib/modules'

/*
| LE NOTCH.
|
| Une découpe blanche accrochée sous la barre, centrée, aussi large que son
| contenu. Elle porte toute la navigation sur deux étages : le MODULE, choisi
| dans le sélecteur de gauche, et ses PAGES, à côté, en onglets soulignés.
|
| Un module d'une seule page n'affiche aucun onglet : le notch se réduit alors
| à son sélecteur, et c'est voulu — un onglet unique ne dit rien que le
| sélecteur ne dise déjà.
|
| Le volet du sélecteur reprend la maquette : la liste des modules à gauche,
| et, pour celui qu'on survole, ses pages rangées par groupe à droite. On
| atteint donc n'importe quelle page en un survol et un clic, sans passer par
| l'accueil du module.
*/

interface NotchNavProps {
  modules: AppModule[]
  /** Le module qui porte la page ouverte. */
  current: AppModule
  /** La clé de la page ouverte. */
  page: string
  onSelect: (page: string) => void
}

export function NotchNav({ modules, current, page, onSelect }: NotchNavProps) {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const anchor = useRef<HTMLDivElement>(null)

  /* Un clic à côté referme : un sélecteur de module ne mérite pas une modale. */
  useEffect(() => {
    if (!open) return

    const onDown = (event: MouseEvent) => {
      if (!anchor.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const go = (key: string) => {
    onSelect(key)
    setOpen(false)
    setHovered(null)
  }

  /* Un module d'une seule page n'a pas d'onglets, donc pas de séparateur. */
  const tabs = current.pages.length > 1
  const Chip = current.icon
  const flyout = modules.find((entry) => entry.key === hovered && entry.groups.length > 0) ?? null
  const flyIndex = flyout ? modules.indexOf(flyout) : 0

  return (
    <nav aria-label={`Navigation ${current.label}`} className="notch">
      <div
        ref={anchor}
        className={cn('relative flex items-center', tabs && 'mr-2 pr-3')}
        style={tabs ? { borderRight: '1px solid var(--color-divider)' } : undefined}
      >
        <button
          type="button"
          className="mod-switch"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Changer de module (actuel : ${current.label})`}
          onClick={() => setOpen(!open)}
        >
          <span
            className="grid size-[30px] place-items-center rounded-lg"
            style={{ background: current.color, color: 'var(--color-surface)' }}
          >
            <Chip size={17} weight="bold" />
          </span>
          <span
            className="whitespace-nowrap"
            style={{ font: '700 16px var(--font-body)', color: 'var(--color-title)' }}
          >
            {current.label}
          </span>
          <CaretUpDown size={16} color="var(--muted)" />
        </button>

        {open && (
          <div className="absolute top-full left-0 z-40 flex items-start gap-2 pt-1">
            <div role="menu" aria-label="Modules" className="menu w-[268px] flex-none">
              {modules.map((entry) => {
                const on = entry.key === current.key
                const Glyph = entry.icon

                return (
                  <button
                    key={entry.key}
                    type="button"
                    role="menuitem"
                    className="menu-item"
                    aria-current={on ? 'page' : 'false'}
                    onMouseEnter={() => setHovered(entry.key)}
                    onClick={() => go(entry.pages[0].key)}
                    style={{
                      background: on
                        ? softOf(entry.color)
                        : entry.key === hovered
                          ? 'var(--soft)'
                          : 'transparent',
                      color: on ? entry.color : 'var(--color-text)',
                      fontWeight: on ? 700 : 600,
                    }}
                  >
                    <span
                      className="grid size-7 flex-none place-items-center rounded-lg"
                      style={{
                        background: on ? entry.color : softOf(entry.color),
                        color: on ? 'var(--color-surface)' : entry.color,
                      }}
                    >
                      <Glyph size={15} weight="bold" />
                    </span>
                    <span className="flex-1">{entry.label}</span>
                    <span
                      className="num"
                      style={{ font: '600 11.5px var(--mono)', color: 'var(--faint)' }}
                    >
                      {entry.count}
                    </span>
                    {entry.groups.length > 0 && <CaretRight size={13} color="var(--faint)" />}
                  </button>
                )
              })}
            </div>

            {/* Les pages du module survolé, rangées par groupe. */}
            {flyout && (
              <div
                role="menu"
                aria-label={flyout.label}
                className="menu w-[420px] gap-[14px] p-[18px_20px_20px]"
                style={{ marginTop: Math.max(0, flyIndex * 46 - 4) }}
              >
                <div className="flex items-center gap-[10px]">
                  <span
                    className="grid size-[30px] place-items-center rounded-lg"
                    style={{ background: softOf(flyout.color), color: flyout.color }}
                  >
                    <flyout.icon size={16} weight="bold" />
                  </span>
                  <span
                    className="flex-1"
                    style={{ font: '700 16px var(--font-body)', color: 'var(--color-title)' }}
                  >
                    {flyout.label}
                  </span>
                  <span style={{ font: '700 12px var(--font-body)', color: 'var(--muted)' }}>
                    {flyout.pages.length} vues
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-[18px] gap-y-4">
                  {flyout.groups.map((group) => (
                    <div key={group.label} className="flex flex-col gap-[2px]">
                      <div
                        className="px-2 pb-1"
                        style={{
                          font: '700 11px var(--font-body)',
                          letterSpacing: '.08em',
                          textTransform: 'uppercase',
                          color: 'var(--muted)',
                        }}
                      >
                        {group.label}
                      </div>
                      {group.pages.map((entry) => (
                        <PageItem
                          key={entry.key}
                          page={entry}
                          color={flyout.color}
                          on={entry.key === page}
                          onPick={() => go(entry.key)}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {tabs &&
        current.pages.map((entry) => {
          const on = entry.key === page
          /* Un espace porte sa propre couleur jusque dans son soulignement. */
          const ink = entry.color ?? current.color

          return (
            <button
              key={entry.key}
              type="button"
              className="notch-tab"
              aria-current={on ? 'page' : 'false'}
              onClick={() => onSelect(entry.key)}
              style={{
                color: on ? ink : undefined,
                borderBottomColor: on ? ink : 'transparent',
              }}
            >
              {entry.color && (
                <span
                  className="size-[7px] rounded-full"
                  style={{ background: entry.color }}
                  aria-hidden
                />
              )}
              {entry.label}
              <span
                className="num"
                style={{ font: '600 11px var(--mono)', color: on ? ink : 'var(--faint)' }}
              >
                {entry.count}
              </span>
            </button>
          )
        })}
    </nav>
  )
}

/** Une page dans le volet : son libellé, son compteur, une flèche au survol. */
function PageItem({
  page,
  color,
  on,
  onPick,
}: {
  page: ModulePage
  color: string
  on: boolean
  onPick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className="menu-item"
      aria-current={on ? 'page' : 'false'}
      onClick={onPick}
      style={{
        background: on ? softOf(color) : 'transparent',
        color: on ? color : 'var(--color-text)',
        fontWeight: on ? 700 : 600,
        padding: '7px 8px',
      }}
    >
      {page.color && (
        <span
          className="size-[7px] flex-none rounded-full"
          style={{ background: page.color }}
          aria-hidden
        />
      )}
      <span className="min-w-0 flex-1 truncate">{page.label}</span>
      <span className="num" style={{ font: '600 11.5px var(--mono)', color: 'var(--faint)' }}>
        {page.count}
      </span>
    </button>
  )
}
