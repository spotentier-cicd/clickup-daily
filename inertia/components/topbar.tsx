import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Link } from '@adonisjs/inertia/react'
import {
  ArrowsClockwise,
  CaretUpDown,
  CheckSquare,
  ClockCounterClockwise,
  GearSix,
  MagnifyingGlass,
  Square,
  WarningCircle,
} from '@phosphor-icons/react'
import { cn } from 'cn'
import { THEMES, THEME_SHORT, type Theme } from '@/lib/theme'
import { formatHours, formatLongDate, formatTime } from '@/lib/format'
import type { Pointage } from '@/lib/report'

/*
| LA BARRE HAUTE.
|
| Bleu nuit, pleine largeur, collée en haut : elle ne porte que ce qui vaut
| pour l'application entière, et rien de ce qui ne vaut que pour une vue.
|
| Trois zones, et l'ordre de la maquette : ce qu'on regarde à gauche (le
| périmètre), ce qu'on cherche au centre, et qui on est à droite — avec, sur
| le chemin, les deux seules commandes qu'on déclenche plusieurs fois par
| jour : restreindre à mes tâches, et relancer la collecte.
|
| Le reste — thème, archive, paramétrage — tombe du menu du compte : ce sont
| des réglages, et un réglage ne mérite pas une place permanente.
|
| LA RECHERCHE EST AU MILIEU DE LA PAGE, pas au milieu de ce qui reste. Les
| deux flancs partent donc de la même base et grandissent du même pas : ils
| finissent à la même largeur, et la gélule tombe pile au centre. Ça ne tient
| que tant que le flanc droit rentre dans sa moitié — sinon il la déborde, et
| pousse la recherche vers la gauche.
|
| D'où les trois paliers ci-dessous, qui ne sont pas des tailles d'écran mais
| des largeurs calculées : chaque pièce s'efface juste avant de commencer à
| décentrer la recherche, dans l'ordre de ce qu'on perd le moins —
|
|   < 1760 px : la jauge de pointage (la carte de la synthèse la donne en entier) ;
|   < 1440 px : le libellé « mes tâches » (l'icône et le compte restent) ;
|   < 1220 px : le nom (le menu du compte l'affiche, avec la date).
|
| Chaque palier est pris au-dessus de la largeur où ça coince — une trentaine
| de pixels de marge, de quoi laisser le compteur de « mes tâches » passer à
| trois chiffres et le nom s'allonger sans rien décaler. Sous 792 px la barre
| se replie en trois lignes, et la question ne se pose plus.
|
| « Rafraîchir » n'a pas de libellé pour la même raison : avec lui, le flanc
| droit dépasse sa moitié à TOUTE largeur. Il garde son infobulle, et affiche
| le décompte des secondes pendant la collecte.
*/

interface TopbarProps {
  /** Le sélecteur de périmètre, monté par la page pour rester maître de son état. */
  scope: ReactNode
  search: string
  onSearch: (value: string) => void
  searchRef: RefObject<HTMLInputElement | null>
  mineOnly: boolean
  mineCount: number
  onMineOnly: () => void
  refreshing: boolean
  elapsed: number
  onRefresh: () => void
  error: string | null
  theme: Theme
  onTheme: (theme: Theme) => void
  me: string
  generatedAt: string
  pointage: Pointage | null
  days: { day: string; ranAt: string }[]
  day: string | null
  archive: boolean
}

export function Topbar({
  scope,
  search,
  onSearch,
  searchRef,
  mineOnly,
  mineCount,
  onMineOnly,
  refreshing,
  elapsed,
  onRefresh,
  error,
  theme,
  onTheme,
  me,
  generatedAt,
  pointage,
  days,
  day,
  archive,
}: TopbarProps) {
  const MineIcon = mineOnly ? CheckSquare : Square

  return (
    <header className="appbar">
      <div className="appbar-inner">
        <div className="flex flex-[1_1_220px] items-center gap-3">{scope}</div>

        <label className="searchpill">
          <MagnifyingGlass size={17} color="var(--faint)" className="shrink-0" />
          <input
            ref={searchRef}
            type="search"
            aria-label="Rechercher"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Rechercher réf, titre, personne, branche, tag…"
          />
          {!search && <kbd>/</kbd>}
        </label>

        <div className="flex min-w-0 flex-[1_1_220px] flex-nowrap items-center justify-end gap-[6px]">
          {pointage && <PointageChip pointage={pointage} />}

          <button
            type="button"
            className="nav-ghost"
            aria-pressed={mineOnly}
            onClick={onMineOnly}
            title="N’afficher que mes tâches (m)"
          >
            <MineIcon size={18} />
            <span className="hidden min-[1440px]:inline">mes tâches</span>
            <span className="nav-count num">{mineCount}</span>
          </button>

          <button
            type="button"
            className="nav-ghost num"
            onClick={onRefresh}
            disabled={refreshing}
            title="Relancer une collecte ClickUp"
          >
            <ArrowsClockwise size={18} className={cn(refreshing && 'animate-spin')} />
            {refreshing && `${elapsed} s`}
          </button>

          <div className="h-7 w-px" style={{ background: 'var(--color-nav-line)' }} />

          <UserMenu
            me={me}
            generatedAt={generatedAt}
            theme={theme}
            onTheme={onTheme}
            days={days}
            day={day}
            archive={archive}
          />
        </div>
      </div>

      {/*
        L'échec d'une collecte reste sous les yeux jusqu'à la navigation
        suivante : le toast du layout, lui, passe et s'efface.
      */}
      {error && (
        <div
          className="flex items-center gap-[6px] pb-[10px] pl-2"
          style={{ font: '700 12.5px var(--font-body)', color: '#ffb4ab' }}
        >
          <WarningCircle size={15} />
          {error}
        </div>
      )}
    </header>
  )
}

/**
 * Le pointage, réduit à une gélule.
 *
 * C'est la seule mesure qui se rattrape mal après coup : elle reste donc sous
 * les yeux où qu'on soit dans l'application. Le détail — les cinq journées,
 * le trait de l'attendu — est dans la carte de la synthèse.
 */
function PointageChip({ pointage }: { pointage: Pointage }) {
  const late = pointage.gapMs > 0
  const filled = pointage.weekTargetMs
    ? Math.min(100, (pointage.weekMs / pointage.weekTargetMs) * 100)
    : 0

  return (
    <div
      className="hidden items-center gap-[10px] rounded-[10px] px-[10px] py-[6px] min-[1760px]:flex"
      style={{ background: 'rgb(255 255 255 / 0.07)' }}
      title={
        late
          ? `${formatHours(pointage.gapMs)} à rattraper sur la semaine`
          : 'Les journées révolues sont saisies'
      }
    >
      <ClockCounterClockwise size={16} color={late ? '#f0b45c' : '#6fd6c0'} />
      <div className="flex flex-col gap-[4px]">
        <span className="num" style={{ font: '700 11.5px/1 var(--mono)', color: '#ffffff' }}>
          {formatHours(pointage.weekMs)}
          <span style={{ color: 'var(--color-nav-dim)' }}>
            {' / '}
            {formatHours(pointage.weekTargetMs)}
          </span>
        </span>
        <span
          className="relative block h-[4px] w-[56px] overflow-hidden"
          style={{ borderRadius: 2, background: 'rgb(255 255 255 / 0.16)' }}
        >
          <span
            className="absolute inset-y-0 left-0"
            style={{
              width: `${filled}%`,
              borderRadius: 2,
              background: late ? '#f0b45c' : '#6fd6c0',
            }}
          />
        </span>
      </div>
    </div>
  )
}

/**
 * Le menu du compte.
 *
 * Il porte ce qui se règle une fois de temps en temps : le jour affiché, le
 * thème, le paramétrage. Il s'ouvre au clic et se referme au clic à côté — un
 * menu de réglages ne mérite pas une modale.
 */
function UserMenu({
  me,
  generatedAt,
  theme,
  onTheme,
  days,
  day,
  archive,
}: {
  me: string
  generatedAt: string
  theme: Theme
  onTheme: (theme: Theme) => void
  days: { day: string; ranAt: string }[]
  day: string | null
  archive: boolean
}) {
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLDivElement>(null)

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

  return (
    <div ref={anchor} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex h-[46px] cursor-pointer items-center gap-[10px] rounded-xl border-0 py-0 pr-[10px] pl-1 text-left"
        style={{ background: open ? 'rgb(255 255 255 / 0.1)' : 'transparent', color: '#ffffff' }}
      >
        <span
          className="grid size-[34px] place-items-center rounded-full"
          style={{ background: 'var(--color-nav-line)', font: '700 12px var(--font-body)' }}
        >
          {initials(me)}
        </span>
        <span className="hidden max-w-[136px] min-w-0 flex-col leading-[1.2] min-[1220px]:flex">
          <span className="truncate" style={{ font: '700 14px var(--font-body)' }}>
            {me || 'Point ClickUp'}
          </span>
          <span
            className="truncate"
            style={{ font: '700 11px var(--font-body)', color: 'var(--color-nav-dim)' }}
          >
            {archive ? `archive du ${day}` : `collecté à ${formatTime(generatedAt)}`}
          </span>
        </span>
        <CaretUpDown size={16} color="var(--color-nav-dim)" />
      </button>

      {open && (
        <div className="absolute top-full right-0 z-50 pt-2">
          <div role="menu" aria-label="Compte" className="menu w-[330px]">
            <div className="flex items-center gap-3 px-[10px] pt-[10px] pb-3">
              <span
                className="grid size-11 place-items-center rounded-full"
                style={{
                  background: 'var(--color-accent)',
                  color: '#ffffff',
                  font: '700 15px var(--font-body)',
                }}
              >
                {initials(me)}
              </span>
              <span className="flex min-w-0 flex-col leading-[1.25]">
                <span style={{ font: '700 16px var(--font-body)', color: 'var(--color-title)' }}>
                  {me || 'Point ClickUp'}
                </span>
                <span
                  className="first-letter:uppercase"
                  style={{ font: '700 12.5px var(--font-body)', color: 'var(--muted)' }}
                >
                  {formatLongDate(generatedAt)} · {formatTime(generatedAt)}
                </span>
              </span>
            </div>

            <div className="menu-sep" />

            {/* Le jour affiché : seulement s'il y a plus d'un rapport à ouvrir. */}
            {days.length > 1 && (
              <label className="flex items-center gap-3 px-[10px] py-2">
                <span className="flex-1" style={{ font: '700 14px var(--font-body)' }}>
                  Jour
                </span>
                <select
                  className="input"
                  style={{ width: 'auto', minHeight: 32, fontSize: 12.5 }}
                  value={day ?? ''}
                  onChange={(event) => {
                    const chosen = event.target.value
                    globalThis.location.href = chosen === days[0].day ? '/' : `/r/${chosen}`
                  }}
                >
                  {days.map((entry) => (
                    <option key={entry.day} value={entry.day}>
                      {entry.day === days[0].day ? `${entry.day} — dernier` : entry.day}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="flex items-center gap-3 px-[10px] py-2">
              <span className="flex-1" style={{ font: '700 14px var(--font-body)' }}>
                Thème
              </span>
              <div className="segmented">
                {THEMES.map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    aria-pressed={theme === entry}
                    onClick={() => onTheme(entry)}
                  >
                    {THEME_SHORT[entry]}
                  </button>
                ))}
              </div>
            </div>

            <div className="menu-sep" />

            <Link href="/parametres" role="menuitem" className="menu-item">
              <GearSix size={18} color="var(--muted)" />
              Paramétrage
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

/** Deux lettres, prises sur les deux premiers mots du nom. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 'PC'
  return (words[0][0] + (words[1]?.[0] ?? '')).toUpperCase()
}
