import { useEffect, useRef } from 'react'
import { Link } from '@adonisjs/inertia/react'
import {
  ArrowCounterClockwise,
  CaretUpDown,
  CheckSquare,
  MinusSquare,
  Square,
  Stack,
} from '@phosphor-icons/react'
import { orderedEnvironments } from '#domain/projects'
import type { Icon } from '@phosphor-icons/react'
import type { FieldUsage, ProjectCatalog, ProjectControls } from '@/lib/projects'

/*
| LE PÉRIMÈTRE.
|
| Ce qu'on regarde se choisit ici, et se persiste côté serveur : le choix doit
| survivre au rechargement, valoir sur une archive, et être lisible par la
| commande de collecte.
|
| Le panneau ne masque JAMAIS en silence : le pied dit toujours combien de
| listes sont écartées, et le bouton de la barre passe en accentué tant qu'il
| en reste une.
*/

interface ScopePopoverProps {
  catalog: ProjectCatalog
  fields: FieldUsage[]
  projects: ProjectControls
  envColors: Map<string, string>
  /** Tâches écartées par le périmètre réglé dans /parametres. */
  hiddenByScope: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ScopePopover({
  catalog,
  fields,
  projects,
  envColors,
  hiddenByScope,
  open,
  onOpenChange,
}: ScopePopoverProps) {
  const anchor = useRef<HTMLDivElement>(null)

  /* Un clic à côté referme : un panneau de filtres ne mérite pas une modale. */
  useEffect(() => {
    if (!open) return

    const onDown = (event: MouseEvent) => {
      if (!anchor.current?.contains(event.target as Node)) onOpenChange(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false)
    }

    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onOpenChange])

  const environments = orderedEnvironments(catalog, projects.preferences)
  const lists = environments.flatMap((environment) => environment.lists)
  const shown = lists.filter((list) => projects.isListVisible(list.envKey, list.name)).length
  const hidden = lists.length - shown

  /*
   * Ce que le bouton de la barre annonce.
   *
   * Un seul espace affiché se nomme ; plusieurs se comptent. Le détail — les
   * listes — tient dans le compteur de la ligne du dessus, parce que c'est à
   * la liste qu'on coche, pas à l'espace.
   */
  const openEnvironments = environments.filter((environment) =>
    environment.lists.some((list) => projects.isListVisible(list.envKey, list.name))
  )
  const title =
    openEnvironments.length === 1
      ? openEnvironments[0].label
      : openEnvironments.length === environments.length
        ? 'Tous les espaces'
        : `${openEnvironments.length} espaces sur ${environments.length}`

  return (
    <div ref={anchor} className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="nav-chip"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Changer de périmètre : ${title}`}
      >
        <span
          className="grid size-8 flex-none place-items-center rounded-lg"
          style={{ background: '#ffffff', color: 'var(--color-nav)' }}
        >
          <Stack size={18} weight="bold" />
        </span>
        <span className="flex flex-col leading-[1.2]">
          <span
            className="num"
            style={{
              font: '700 10px var(--font-body)',
              letterSpacing: '.08em',
              color: 'var(--color-nav-dim)',
            }}
          >
            PÉRIMÈTRE · {shown}/{lists.length} LISTES
          </span>
          <span className="max-w-[220px] truncate" style={{ font: '700 15px var(--font-body)' }}>
            {title}
          </span>
        </span>
        <CaretUpDown size={16} color="var(--color-nav-dim)" />
      </button>

      {open && (
        <div
          className="absolute top-[calc(100%+8px)] left-0 z-50 flex w-[360px] max-w-[calc(100vw-32px)] flex-col overflow-hidden"
          style={{
            borderRadius: 16,
            background: 'var(--color-surface)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <div className="flex items-center justify-between px-[14px] pt-3 pb-[10px]">
            <span style={KICKER}>Projets affichés</span>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: 12.5, padding: '3px 6px' }}
              onClick={projects.reset}
            >
              Tout
            </button>
          </div>
          <div className="rule" />

          <div className="flex max-h-[min(420px,60vh)] flex-col gap-2 overflow-auto px-[6px] py-2">
            {environments.map((environment) => {
              const visible = environment.lists.filter((list) =>
                projects.isListVisible(list.envKey, list.name)
              ).length
              const all =
                visible === environment.lists.length &&
                projects.isEnvironmentVisible(environment.key)

              return (
                <div key={environment.key} className="flex flex-col gap-[1px]">
                  <button
                    type="button"
                    onClick={() => projects.toggleEnvironment(environment.key)}
                    onDoubleClick={() => projects.onlyEnvironment(catalog, environment.key)}
                    title="Clic : afficher ou masquer · double-clic : n’afficher que celui-ci"
                    className="hoverable flex w-full cursor-pointer items-center gap-[9px] rounded-md border-0 bg-transparent px-2 py-[7px] text-left"
                    style={{ font: '600 13.5px var(--font-body)', color: 'var(--color-text)' }}
                  >
                    <Box on={all} partial={visible > 0} />
                    <span
                      className="size-[7px] rounded-full"
                      style={{ background: envColors.get(environment.key) }}
                    />
                    <span className="flex-1">{environment.label}</span>
                    <span
                      className="num"
                      style={{ font: '400 11.5px var(--mono)', color: 'var(--faint)' }}
                    >
                      {environment.total} · {environment.mine} à moi
                    </span>
                  </button>

                  {environment.lists.map((list) => {
                    const on = projects.isListVisible(list.envKey, list.name)

                    return (
                      <button
                        key={list.key}
                        type="button"
                        onClick={() => projects.toggleList(list.envKey, list.name)}
                        onDoubleClick={() => projects.onlyList(catalog, list.envKey, list.name)}
                        title="Clic : afficher ou masquer · double-clic : n’afficher que celle-ci"
                        className="hoverable flex w-full cursor-pointer items-center gap-[9px] rounded-md border-0 bg-transparent py-[6px] pr-2 pl-[30px] text-left"
                        style={{
                          font: '500 13px var(--font-body)',
                          color: on ? 'var(--color-text)' : 'var(--muted)',
                        }}
                      >
                        <Box on={on} />
                        <span className="min-w-0 flex-1 truncate">{list.name}</span>
                        <span
                          className="num"
                          style={{ font: '400 11.5px var(--mono)', color: 'var(--faint)' }}
                        >
                          {list.total}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )
            })}

            {fields.length > 0 && <FieldSection fields={fields} projects={projects} />}
          </div>

          {/*
            Ce qui est masqué ailleurs se dit ici : sans ça, une tâche absente
            du tableau n'aurait aucune explication à portée de clic.
          */}
          {hiddenByScope > 0 && (
            <>
              <div className="rule" />
              <div
                className="px-[14px] py-2"
                style={{ font: '500 12px/1.5 var(--font-body)', color: 'var(--muted)' }}
              >
                {hiddenByScope} tâche{hiddenByScope > 1 ? 's' : ''} écartée
                {hiddenByScope > 1 ? 's' : ''} par le périmètre (liste ou statut) —{' '}
                <Link href="/parametres" style={{ color: 'var(--color-accent)' }}>
                  paramétrage
                </Link>
              </div>
            </>
          )}

          <div className="rule" />
          <div className="flex items-center justify-between py-2 pr-[10px] pl-[14px]">
            <span
              style={{
                font: '500 12px var(--font-body)',
                color: hidden ? 'var(--amber)' : 'var(--muted)',
              }}
            >
              {hidden
                ? `${hidden} liste${hidden > 1 ? 's' : ''} masquée${hidden > 1 ? 's' : ''}`
                : 'Tout est affiché'}
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: 12.5, padding: '5px 10px' }}
              onClick={projects.reset}
            >
              <ArrowCounterClockwise size={14} />
              Réinitialiser
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Les champs personnalisés, avec leur couverture.
 *
 * ClickUp en renvoie beaucoup, et un champ renseigné sur toutes les tâches ne
 * distingue aucune tâche des autres : `noisy` le dit, et un seul bouton range
 * tous ceux-là d'un coup.
 */
function FieldSection({ fields, projects }: { fields: FieldUsage[]; projects: ProjectControls }) {
  const noisy = fields.filter((field) => field.noisy && projects.isFieldVisible(field.name))

  return (
    <div className="mt-1 flex flex-col gap-[1px] pt-2">
      <div className="rule mb-2" />
      <div className="flex items-center justify-between px-2 pb-1">
        <span style={KICKER}>Champs affichés</span>
        {noisy.length > 0 && (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: 12.5, padding: '3px 6px' }}
            onClick={() => projects.hideNoisyFields(fields)}
          >
            Masquer les {noisy.length} inutiles
          </button>
        )}
      </div>

      {fields.map((field) => {
        const on = projects.isFieldVisible(field.name)

        return (
          <button
            key={field.name}
            type="button"
            onClick={() => projects.toggleField(field.name)}
            className="hoverable flex w-full cursor-pointer items-center gap-[9px] rounded-md border-0 bg-transparent px-2 py-[6px] text-left"
            style={{
              font: '500 13px var(--font-body)',
              color: on ? 'var(--color-text)' : 'var(--muted)',
            }}
          >
            <Box on={on} />
            <span className="min-w-0 flex-1 truncate">{field.name}</span>
            <span
              className="num"
              style={{
                font: '400 11.5px var(--mono)',
                color: field.noisy ? 'var(--amber)' : 'var(--faint)',
              }}
              title={
                field.noisy
                  ? 'Présent presque partout ou à valeur unique : il ne distingue rien'
                  : undefined
              }
            >
              {field.count} · {field.distinct} val.
            </span>
          </button>
        )
      })}
    </div>
  )
}

const KICKER = {
  font: '700 11px var(--font-body)',
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  color: 'var(--muted)',
} as const

/** Coché, partiellement coché, décoché — trois glyphes, jamais une opacité. */
function Box({ on, partial = false }: { on: boolean; partial?: boolean }) {
  const [Glyph, weight, color]: [Icon, 'fill' | 'regular', string] = on
    ? [CheckSquare, 'fill', 'var(--color-accent)']
    : partial
      ? [MinusSquare, 'fill', 'var(--color-accent)']
      : [Square, 'regular', 'var(--faint)']

  return <Glyph size={17} weight={weight} color={color} className="shrink-0" />
}
