import { type ReactNode, type RefObject } from 'react'
import {
  ArrowsClockwise,
  CheckSquare,
  CircleHalf,
  MagnifyingGlass,
  Moon,
  Square,
  Sun,
  WarningCircle,
} from '@phosphor-icons/react'
import { cn } from 'cn'
import { THEME_LABEL, type Theme } from '@/lib/theme'
import type { Icon } from '@phosphor-icons/react'

/*
| LA BARRE DE COMMANDE.
|
| Elle ne porte que ce qui s'applique à toute la page : chercher, restreindre,
| relancer, changer de thème. Tout ce qui ne vaut que pour une vue est descendu
| dans cette vue.
*/

const THEME_ICON: Record<Theme, Icon> = { auto: CircleHalf, light: Sun, dark: Moon }

interface ToolbarProps {
  search: string
  onSearch: (value: string) => void
  searchRef: RefObject<HTMLInputElement | null>
  mineOnly: boolean
  onMineOnly: () => void
  refreshing: boolean
  elapsed: number
  onRefresh: () => void
  error: string | null
  theme: Theme
  onTheme: () => void
  /** Le panneau de périmètre, monté par la page pour rester maître de son état. */
  scope: ReactNode
}

export function Toolbar({
  search,
  onSearch,
  searchRef,
  mineOnly,
  onMineOnly,
  refreshing,
  elapsed,
  onRefresh,
  error,
  theme,
  onTheme,
  scope,
}: ToolbarProps) {
  const ThemeIcon = THEME_ICON[theme]
  const MineIcon = mineOnly ? CheckSquare : Square

  return (
    <div
      className="sticky top-0 z-30"
      style={{
        background: 'color-mix(in srgb, var(--color-bg) 80%, transparent)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      }}
    >
      <div className="mx-auto flex max-w-[1760px] flex-wrap items-center gap-x-3 gap-y-[10px] px-7 py-[10px]">
        <label className="relative flex min-w-0 flex-[1_1_280px] items-center">
          <MagnifyingGlass
            size={15}
            color="var(--faint)"
            className="pointer-events-none absolute left-[11px]"
          />
          <input
            ref={searchRef}
            className="input"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Rechercher réf, titre, personne, branche, tag…"
            style={{ paddingLeft: 34, paddingRight: 34, height: 36 }}
          />
          {!search && (
            <span
              className="absolute right-[9px] rounded-sm px-[6px] py-[3px]"
              style={{
                font: '500 11px/1 var(--mono)',
                boxShadow: 'var(--shadow-sm)',
                color: 'var(--faint)',
              }}
            >
              /
            </span>
          )}
        </label>

        {scope}

        <button
          type="button"
          onClick={onMineOnly}
          className={cn('btn', mineOnly ? 'btn-primary' : 'btn-secondary')}
          style={{ height: 36 }}
        >
          <MineIcon size={15} />
          mes tâches
        </button>

        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="btn btn-secondary num"
          style={{ height: 36 }}
        >
          <ArrowsClockwise size={15} className={cn(refreshing && 'animate-spin')} />
          {refreshing ? `Collecte… ${elapsed} s` : 'Rafraîchir'}
        </button>

        <button
          type="button"
          onClick={onTheme}
          className="btn btn-secondary btn-icon"
          title={THEME_LABEL[theme]}
        >
          <ThemeIcon size={16} />
        </button>
      </div>

      {error && (
        <div
          className="mx-auto flex max-w-[1760px] items-center gap-[6px] px-7 pb-[10px]"
          style={{ font: '500 12.5px var(--font-body)', color: 'var(--red)' }}
        >
          <WarningCircle size={15} />
          {error}
        </div>
      )}

      <div className="rule" />
    </div>
  )
}
