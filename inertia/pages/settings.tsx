import { useMemo, useState } from 'react'
import { router } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import {
  ArrowLeft,
  CaretRight,
  CheckSquare,
  FloppyDisk,
  Lock,
  MinusSquare,
  Square,
  WarningCircle,
} from '@phosphor-icons/react'
import { OTHER_COLUMN, proposeColumn } from '#domain/task/columns'
import { normalize } from '#domain/text'
import { CARD, KICKER } from '@/lib/styles'
import { formatDateTime } from '@/lib/format'
import type { Icon } from '@phosphor-icons/react'
import type { Column, ColumnMapping } from '#domain/task/types'
import type { AppOptions } from '#domain/options'

/*
| LA PAGE DE PARAMÉTRAGE.
|
| L'arborescence ClickUp telle qu'elle est — espace, dossier, liste — et, sur
| chaque liste, les statuts qu'on veut voir.
|
| POURQUOI LA LISTE : c'est le niveau où ClickUp définit les statuts. « ROC
| Sprints » et ses 28 listes partagent les mêmes, mais « ROC QA » a les siens ;
| ranger le réglage plus haut obligerait à inventer une union qui ne
| correspondrait à aucun écran ClickUp. Espace et dossier ne sont donc que des
| raccourcis de cochage.
|
| Cocher une liste la fait collecter ET afficher ; la décocher l'en sort tout
| de suite, sans rien effacer. Ce qui n'est pas coché n'entre pas : un sprint
| créé le mois prochain se signale ici, il n'apparaît pas tout seul.
*/

type StatusRow = {
  name: string
  tasks: number
}

type ListRow = {
  id: string
  name: string
  followed: boolean
  allowed: string[]
  /** Statuts apparus depuis le dernier tri. */
  fresh: string[]
  tasks: number
  statuses: StatusRow[]
}

type FolderRow = { id: string; name: string; lists: ListRow[] }

type SpaceRow = {
  id: string
  name: string
  isPrivate: boolean
  folders: FolderRow[]
  /** Listes sans dossier. */
  lists: ListRow[]
}

interface SettingsProps {
  spaces: SpaceRow[]
  /** Les étapes du workflow, « Autres » comprise. */
  columns: Column[]
  /** Rattachements statut → colonne déjà choisis ; le reste est proposé. */
  mapping: ColumnMapping
  teams: { id: string; name: string }[]
  team: string | null
  /** Ce qui s'allume et s'éteint, hors périmètre ClickUp. */
  options: AppOptions
  lastRunAt: string | null
  error: string | null
}

/**
 * L'état d'édition : par liste, les statuts cochés.
 *
 * `seen` mémorise ce que la liste proposait au moment du choix — c'est ce qui
 * permet de signaler plus tard un statut ajouté dans ClickUp sans crier au
 * loup sur les douze qu'on n'a simplement jamais voulus.
 */
type Draft = Record<string, { space: string; statuses: string[]; seen: string[] }>

export default function Settings({
  spaces,
  columns,
  mapping,
  teams,
  team,
  options,
  lastRunAt,
  error,
}: SettingsProps) {
  const initial = useMemo(() => {
    const draft: Draft = {}
    for (const space of spaces) {
      for (const list of allLists(space)) {
        if (list.followed)
          draft[list.id] = {
            space: space.id,
            statuses: list.allowed,
            seen: list.statuses.map((status) => status.name),
          }
      }
    }
    return draft
  }, [spaces])

  const [draft, setDraft] = useState<Draft>(initial)
  const [chosenTeam, setChosenTeam] = useState(team)
  const [columnMap, setColumnMap] = useState<ColumnMapping>(mapping)
  const [claude, setClaude] = useState(options.claude)
  const [saving, setSaving] = useState(false)

  /*
   * La colonne où atterrit un statut : le choix explicite d'abord, la
   * proposition ensuite. C'est la même règle que côté serveur — elle est dans
   * le domaine, partagée, pas recopiée.
   */
  const columnOf = (status: string) =>
    columnMap[normalize(status)] ?? proposeColumn(status, columns)?.key ?? OTHER_COLUMN

  const inWorkflow = (status: string) => columnOf(status) !== OTHER_COLUMN

  /*
   * Cocher une liste sans rien d'autre la montrerait vide : on propose donc
   * ses statuts de workflow, qui sont ce qu'on veut voir neuf fois sur dix.
   * C'est une proposition, pas une décision — elle s'édite avant d'enregistrer.
   */
  const toggleList = (spaceId: string, list: ListRow) =>
    setDraft((current) => {
      const next = { ...current }
      if (next[list.id]) delete next[list.id]
      else next[list.id] = follow(spaceId, list, inWorkflow)
      return next
    })

  const setLists = (spaceId: string, lists: ListRow[], on: boolean) =>
    setDraft((current) => {
      const next = { ...current }
      for (const list of lists) {
        if (on) next[list.id] = next[list.id] ?? follow(spaceId, list, inWorkflow)
        else delete next[list.id]
      }
      return next
    })

  const toggleStatus = (list: ListRow, status: string) =>
    setDraft((current) => {
      const entry = current[list.id]
      if (!entry) return current

      const statuses = entry.statuses.includes(status)
        ? entry.statuses.filter((item) => item !== status)
        : [...entry.statuses, status]

      return { ...current, [list.id]: { ...entry, statuses } }
    })

  const setStatuses = (list: ListRow, which: 'all' | 'none' | 'workflow') =>
    setDraft((current) => {
      const entry = current[list.id]
      if (!entry) return current

      const statuses =
        which === 'all'
          ? list.statuses.map((status) => status.name)
          : which === 'none'
            ? []
            : list.statuses.filter((status) => inWorkflow(status.name)).map((status) => status.name)

      return { ...current, [list.id]: { ...entry, statuses } }
    })

  const save = () => {
    router.put(
      '/preferences/scope',
      { team: chosenTeam, lists: draft, columns: columnMap, options: { claude } },
      {
        preserveScroll: true,
        onStart: () => setSaving(true),
        onFinish: () => setSaving(false),
      }
    )
  }

  const followed = Object.keys(draft).length
  const changed =
    !sameDraft(initial, draft) ||
    chosenTeam !== team ||
    claude !== options.claude ||
    JSON.stringify(columnMap) !== JSON.stringify(mapping)

  /* Les statuts réellement cochés : ce sont les seuls qui atterrissent quelque part. */
  const ticked = [...new Set(Object.values(draft).flatMap((entry) => entry.statuses))].sort(
    (a, b) => a.localeCompare(b, 'fr')
  )

  return (
    <div className="mx-auto w-full max-w-[1000px] px-7 pt-6 pb-24">
      <Link
        href="/"
        className="inline-flex items-center gap-2"
        style={{ font: '500 13px var(--font-body)', color: 'var(--muted)' }}
      >
        <ArrowLeft size={14} />
        Retour au tableau de bord
      </Link>

      <h1
        className="mt-4 mb-1"
        style={{ font: '500 28px/1.1 var(--font-heading)', letterSpacing: '-0.02em' }}
      >
        Paramétrage
      </h1>
      <p
        className="mt-0 mb-5"
        style={{ font: '400 13.5px/1.55 var(--font-body)', color: 'var(--muted)' }}
      >
        L’arborescence est lue directement dans ClickUp. Cocher une <strong>liste</strong> la fait
        collecter et l’affiche dans le tableau de bord ; la décocher l’en sort aussitôt, sans rien
        effacer. Les <strong>statuts</strong> se choisissent liste par liste — c’est le niveau où
        ClickUp les définit. Un statut hors du workflow de dev arrive dans la colonne{' '}
        <em>Autres</em> et n’entre pas dans « À débloquer ».
      </p>

      {error && <Banner text={error} />}

      {teams.length > 1 && (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <span style={KICKER}>Équipe ClickUp</span>
          <select
            className="input"
            style={{ width: 'auto', minHeight: 32, fontSize: 13 }}
            value={chosenTeam ?? teams[0]?.id ?? ''}
            onChange={(event) => setChosenTeam(event.target.value)}
          >
            {teams.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
          <span style={{ font: '400 12px var(--font-body)', color: 'var(--faint)' }}>
            Votre jeton en donne {teams.length}. Changer d’équipe change toute l’arborescence.
          </span>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {spaces.map((space) => (
          <SpaceCard
            key={space.id}
            space={space}
            draft={draft}
            inWorkflow={inWorkflow}
            onToggleList={toggleList}
            onSetLists={setLists}
            onToggleStatus={toggleStatus}
            onSetStatuses={setStatuses}
          />
        ))}
      </div>

      <div className="rule my-6" />

      {/*
        Le rattachement des statuts aux étapes du workflow.
        Sans lui, le tableau d'un workspace inconnu rangerait tout dans
        « Autres » et les règles de blocage ne se déclencheraient jamais. Il est
        pré-rempli par déduction sur le nom du statut ; ce qu'on change ici
        l'emporte.
      */}
      <div className="flex flex-col gap-3">
        <span style={KICKER}>Statuts → étapes du workflow</span>
        <p
          className="m-0"
          style={{ font: '400 12.5px/1.55 var(--font-body)', color: 'var(--muted)' }}
        >
          Les étapes portent les règles du tableau : « attend ma relecture » vise{' '}
          <em>Revue à faire</em>, « dort sur recette » vise <em>Recette</em>. Le rattachement est
          deviné à partir du nom du statut — corrigez-le ici, votre choix l’emporte. Un statut rangé
          dans <em>Autres</em> s’affiche mais n’entre dans aucune règle.
        </p>

        {ticked.length === 0 ? (
          <p className="m-0" style={{ font: '400 13px var(--font-body)', color: 'var(--faint)' }}>
            Cochez d’abord des statuts ci-dessus : seuls ceux-là ont besoin d’une étape.
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-x-5 gap-y-[6px]">
            {ticked.map((status) => {
              const value = columnOf(status)
              const explicit = columnMap[normalize(status)] !== undefined

              return (
                <label
                  key={status}
                  className="flex items-center gap-2"
                  style={{ font: '400 13px var(--font-body)' }}
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{
                      background:
                        columns.find((column) => column.key === value)?.color ?? 'var(--faint)',
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate" title={status}>
                    {status}
                  </span>
                  <select
                    className="input"
                    style={{
                      width: 'auto',
                      minHeight: 28,
                      fontSize: 12.5,
                      opacity: explicit ? 1 : 0.75,
                    }}
                    title={explicit ? 'Choix explicite' : 'Proposé d’après le nom du statut'}
                    value={value}
                    onChange={(event) =>
                      setColumnMap((current) => ({
                        ...current,
                        [normalize(status)]: event.target.value,
                      }))
                    }
                  >
                    {columns.map((column) => (
                      <option key={column.key} value={column.key}>
                        {column.label}
                      </option>
                    ))}
                  </select>
                </label>
              )
            })}
          </div>
        )}

        {lastRunAt && (
          <p
            className="m-0 mt-1"
            style={{ font: '400 12px var(--font-body)', color: 'var(--faint)' }}
          >
            Compteurs issus de la collecte du {formatDateTime(lastRunAt)}.
          </p>
        )}
      </div>

      <div className="rule my-6" />

      {/*
        Ce qui ne vient pas de ClickUp.
        Coupé, l'interrupteur vaut pour les deux bouts : plus de lecture des
        transcriptions à la collecte, et la carte disparaît tout de suite du
        tableau de bord. Les rapports déjà enregistrés gardent leur valeur.
      */}
      <div className="flex flex-col gap-3">
        <span style={KICKER}>Hors ClickUp</span>

        <section style={{ ...CARD, padding: '14px 18px 16px' }} className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setClaude((value) => !value)}
            className="flex cursor-pointer items-center gap-[10px] border-0 bg-transparent p-0 text-left"
          >
            <Box on={claude} />
            <span style={{ font: '500 14px var(--font-body)' }}>Coût des conversations Claude</span>
          </button>
          <p
            className="m-0 pl-[27px]"
            style={{ font: '400 12.5px/1.55 var(--font-body)', color: 'var(--muted)' }}
          >
            Décoché, rien n’est lu. Coché, estime au tarif de l’API ce que les conversations du mois
            ont coûté — au total et ticket par ticket — en dépouillant les transcriptions locales de
            Claude Code. Rien n’est envoyé nulle part, et aucun texte de conversation n’est
            conservé. Sur un abonnement, ce montant n’est pas facturé : c’est une mesure d’effort.
          </p>
        </section>
      </div>

      {/* La barre d'enregistrement suit : un réglage se perd trop facilement. */}
      <div
        className="fixed right-0 bottom-0 left-0 z-40"
        style={{
          background: 'color-mix(in srgb, var(--color-bg) 85%, transparent)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
        }}
      >
        <div className="rule" />
        <div className="mx-auto flex max-w-[1000px] items-center gap-3 px-7 py-3">
          <span style={{ font: '400 12.5px var(--font-body)', color: 'var(--muted)' }}>
            {followed} liste{followed > 1 ? 's' : ''} suivie{followed > 1 ? 's' : ''}
            {changed && ' · modifications non enregistrées'}
          </span>
          <span className="flex-1" />
          <button
            type="button"
            className="btn btn-primary"
            style={{ height: 36 }}
            disabled={saving || !changed}
            onClick={save}
          >
            <FloppyDisk size={15} />
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface GroupProps {
  draft: Draft
  /** Un statut rattaché à une étape, par opposition à « Autres ». */
  inWorkflow: (status: string) => boolean
  onToggleList: (spaceId: string, list: ListRow) => void
  onSetLists: (spaceId: string, lists: ListRow[], on: boolean) => void
  onToggleStatus: (list: ListRow, status: string) => void
  onSetStatuses: (list: ListRow, which: 'all' | 'none' | 'workflow') => void
}

function SpaceCard({ space, ...actions }: { space: SpaceRow } & GroupProps) {
  const lists = allLists(space)
  const on = lists.filter((list) => actions.draft[list.id]).length

  return (
    <section style={{ ...CARD, padding: '14px 18px 16px' }} className="flex flex-col gap-3">
      <div className="flex items-center gap-[10px]">
        <button
          type="button"
          onClick={() => actions.onSetLists(space.id, lists, on < lists.length)}
          title={on < lists.length ? 'Tout cocher' : 'Tout décocher'}
          className="flex cursor-pointer items-center gap-[10px] border-0 bg-transparent p-0 text-left"
        >
          <Box on={on === lists.length && on > 0} partial={on > 0} />
          <span style={{ font: '500 16px var(--font-heading)' }}>{space.name}</span>
        </button>
        {space.isPrivate && <Lock size={13} color="var(--faint)" aria-label="Espace privé" />}
        <span className="flex-1" />
        <span className="num" style={{ font: '400 12px var(--mono)', color: 'var(--faint)' }}>
          {on}/{lists.length} listes
        </span>
      </div>

      {space.folders.map((folder) => (
        <Folder key={folder.id} space={space} folder={folder} {...actions} />
      ))}

      {space.lists.length > 0 && (
        <div className="flex flex-col gap-[2px]">
          <div style={{ ...KICKER, fontSize: 11 }}>Sans dossier</div>
          {space.lists.map((list) => (
            <ListLine key={list.id} space={space} list={list} {...actions} />
          ))}
        </div>
      )}
    </section>
  )
}

/**
 * Un dossier, replié au départ — tous, sans exception.
 *
 * « ROC Sprints » a 28 listes et « Tempo Sprint » 27 : ouverts, ils feraient
 * une page de six écrans. La page s'ouvre donc sur la seule chose qui se lit
 * d'un coup d'œil — la liste des dossiers et, pour chacun, combien de ses
 * listes sont suivies.
 */
function Folder({
  space,
  folder,
  ...actions
}: { space: SpaceRow; folder: FolderRow } & GroupProps) {
  const on = folder.lists.filter((list) => actions.draft[list.id]).length
  const [open, setOpen] = useState(false)

  return (
    <div className="flex flex-col gap-[2px]">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => actions.onSetLists(space.id, folder.lists, on < folder.lists.length)}
          title={on < folder.lists.length ? 'Tout cocher' : 'Tout décocher'}
          className="flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left"
        >
          <Box on={on === folder.lists.length && on > 0} partial={on > 0} />
        </button>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="hoverable flex flex-1 cursor-pointer items-center gap-[6px] rounded-md border-0 bg-transparent px-[6px] py-[5px] text-left"
          style={{ font: '500 13.5px var(--font-body)' }}
        >
          <CaretRight
            size={12}
            color="var(--faint)"
            style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 120ms' }}
          />
          {folder.name}
          <span className="num" style={{ font: '400 11.5px var(--mono)', color: 'var(--faint)' }}>
            {on}/{folder.lists.length}
          </span>
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-[2px] pl-[22px]">
          {folder.lists.map((list) => (
            <ListLine key={list.id} space={space} list={list} {...actions} />
          ))}
        </div>
      )}
    </div>
  )
}

function ListLine({ space, list, ...actions }: { space: SpaceRow; list: ListRow } & GroupProps) {
  const entry = actions.draft[list.id]
  const inWorkflow = actions.inWorkflow
  const chosen = new Set(entry?.statuses ?? [])

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => actions.onToggleList(space.id, list)}
        className="hoverable flex w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-[6px] py-[5px] text-left"
        style={{
          font: '400 13px var(--font-body)',
          color: entry ? 'var(--color-text)' : 'var(--muted)',
        }}
      >
        <Box on={Boolean(entry)} />
        <span className="min-w-0 flex-1 truncate">{list.name}</span>
        {list.fresh.length > 0 && (
          <span
            className="tag tag-accent"
            style={{ padding: '1px 6px', fontSize: 10 }}
            title={`Ajouté${list.fresh.length > 1 ? 's' : ''} dans ClickUp depuis votre choix : ${list.fresh.join(', ')}`}
          >
            +{list.fresh.length} statut{list.fresh.length > 1 ? 's' : ''}
          </span>
        )}
        <span className="num" style={{ font: '400 11.5px var(--mono)', color: 'var(--faint)' }}>
          {list.tasks || '—'}
        </span>
      </button>

      {entry && (
        <div className="mb-1 flex flex-col gap-[6px] pb-1 pl-[26px]">
          <div className="flex items-center gap-[6px]">
            <span style={{ ...KICKER, fontSize: 10 }}>Statuts affichés</span>
            {(['workflow', 'all', 'none'] as const).map((which) => (
              <button
                key={which}
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: 11.5, padding: '1px 5px' }}
                onClick={() => actions.onSetStatuses(list, which)}
              >
                {which === 'workflow' ? 'workflow' : which === 'all' ? 'tout' : 'aucun'}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-[4px]">
            {list.statuses.map((status) => {
              const active = chosen.has(status.name)

              return (
                <button
                  key={status.name}
                  type="button"
                  onClick={() => actions.onToggleStatus(list, status.name)}
                  title={
                    inWorkflow(status.name)
                      ? undefined
                      : 'Hors workflow : ces tâches iront dans la colonne « Autres »'
                  }
                  className="flex cursor-pointer items-center gap-[5px] border-0"
                  style={{
                    font: '400 11.5px/1 var(--font-body)',
                    padding: '4px 8px',
                    borderRadius: 999,
                    background: active
                      ? 'color-mix(in srgb, var(--color-accent) 16%, transparent)'
                      : 'var(--soft)',
                    color: active ? 'var(--color-text)' : 'var(--muted)',
                    boxShadow: active ? 'inset 0 0 0 1px var(--color-accent)' : 'none',
                  }}
                >
                  {!inWorkflow(status.name) && (
                    <span
                      className="size-[5px] rounded-full"
                      style={{ background: 'var(--amber)' }}
                    />
                  )}
                  {status.name}
                  {status.tasks > 0 && (
                    <span className="num" style={{ fontFamily: 'var(--mono)', opacity: 0.6 }}>
                      {status.tasks}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {chosen.size === 0 && (
            <p
              className="m-0"
              style={{ font: '400 11.5px var(--font-body)', color: 'var(--amber)' }}
            >
              Aucun statut coché : cette liste est suivie mais n’affichera rien.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function Banner({ text }: { text: string }) {
  return (
    <div
      className="mb-4 flex items-center gap-2 px-[14px] py-3"
      style={{
        borderRadius: 8,
        background: 'color-mix(in srgb, var(--red) 10%, var(--color-surface))',
        boxShadow: '0 0 0 1px color-mix(in srgb, var(--red) 35%, transparent)',
        font: '400 13px var(--font-body)',
      }}
    >
      <WarningCircle size={16} color="var(--red)" />
      {text}
    </div>
  )
}

function Box({ on, partial = false }: { on: boolean; partial?: boolean }) {
  const [Glyph, weight, color]: [Icon, 'fill' | 'regular', string] = on
    ? [CheckSquare, 'fill', 'var(--color-accent)']
    : partial
      ? [MinusSquare, 'fill', 'var(--color-accent)']
      : [Square, 'regular', 'var(--faint)']

  return <Glyph size={17} weight={weight} color={color} className="shrink-0" />
}

/** Une liste qu'on vient de cocher : ses statuts de workflow, et ce qu'elle proposait. */
function follow(spaceId: string, list: ListRow, inWorkflow: (status: string) => boolean) {
  return {
    space: spaceId,
    statuses: list.statuses
      .filter((status) => inWorkflow(status.name))
      .map((status) => status.name),
    seen: list.statuses.map((status) => status.name),
  }
}

function allLists(space: SpaceRow): ListRow[] {
  return [...space.folders.flatMap((folder) => folder.lists), ...space.lists]
}

/** Deux brouillons équivalents, l'ordre des statuts mis à part. */
function sameDraft(a: Draft, b: Draft): boolean {
  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) return false

  return keys.every((key) => {
    const left = a[key]
    const right = b[key]
    if (!right || left.space !== right.space) return false
    if (left.statuses.length !== right.statuses.length) return false
    return [...left.statuses].sort().join('|') === [...right.statuses].sort().join('|')
  })
}
