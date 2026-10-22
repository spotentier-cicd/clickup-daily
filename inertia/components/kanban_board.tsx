import { useEffect, useId, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowSquareOut,
  Check,
  GitBranch,
  PencilSimple,
  Plus,
  Trash,
  X,
} from '@phosphor-icons/react'
import { KANBAN_COLUMNS, cardsOfColumn, moveCard } from '#domain/kanban'
import { branchSuggestions, findTask, matchesCard, useKanban } from '@/lib/kanban'
import { tint } from '@/lib/board'
import { REF } from '@/lib/styles'
import type { Icon } from '@phosphor-icons/react'
import type { KanbanCard, KanbanCardInput, KanbanColumnKey } from '@/lib/kanban'
import type { Report, Task } from '@/lib/report'

/*
| LE TABLEAU PERSONNEL.
|
| Trois colonnes, et la seule partie de l'application qu'on remplit soi-même :
| ce qu'on a à faire, ce qu'on a ouvert, ce qui attend quelqu'un d'autre. Une
| carte porte ce qu'il faut pour reprendre le travail là où on l'a laissé — le
| ticket, les deux branches, et la phrase qu'on se laisse à soi-même — parce
| que c'est précisément ce qu'on perd entre le vendredi soir et le lundi matin.
|
| Le ticket n'est pas obligatoire : on note « relancer l'infra » avant qu'un
| ticket existe. Mais quand il y en a un, la carte sait ouvrir sa fiche, et le
| formulaire va chercher les branches locales que la collecte a déjà trouvées.
|
| Le glisser-déposer redessine tout de suite : la carte survolée est montrée à
| la place qu'elle prendra, calculée par la MÊME fonction que le serveur
| utilisera pour l'enregistrer.
*/

interface KanbanBoardProps {
  cards: KanbanCard[]
  /** Le rapport du jour, pour les branches locales et l'ouverture des fiches. */
  report: Report | null
  /** Les tâches du périmètre : ce que la saisie d'un ticket peut reconnaître. */
  tasks: Task[]
  search: string
  onOpenTask: (id: string) => void
}

export function KanbanBoard({ cards, report, tasks, search, onOpenTask }: KanbanBoardProps) {
  const board = useKanban(cards)

  const [drag, setDrag] = useState<number | null>(null)
  const [over, setOver] = useState<{ column: KanbanColumnKey; index: number } | null>(null)
  const [adding, setAdding] = useState<KanbanColumnKey | null>(null)
  const [editing, setEditing] = useState<number | null>(null)

  /*
   * Pendant un glissement, le tableau affiché est le tableau d'après : la
   * carte est déjà posée où elle tomberait. Un filet d'insertion aurait
   * demandé de savoir dessiner un entre-deux ; montrer le résultat ne demande
   * rien de plus que la fonction qui le produit.
   */
  const shown =
    drag !== null && over ? moveCard(board.cards, drag, over.column, over.index) : board.cards

  const stop = () => {
    setDrag(null)
    setOver(null)
  }

  const drop = () => {
    if (drag !== null && over) board.move(drag, over.column, over.index)
    stop()
  }

  /** Le rang qu'une carte prendrait si on la lâchait là, la carte portée ôtée du compte. */
  const slot = (column: KanbanColumnKey, before: KanbanCard | null, after: boolean) => {
    const list = cardsOfColumn(board.cards, column).filter((card) => card.id !== drag)
    if (!before) return list.length

    const rank = list.findIndex((card) => card.id === before.id)
    if (rank === -1) return list.length

    return after ? rank + 1 : rank
  }

  return (
    <div className="grid grid-cols-1 items-start gap-[18px] md:grid-cols-3">
      {KANBAN_COLUMNS.map((column) => {
        const list = cardsOfColumn(shown, column.key).filter((card) => matchesCard(card, search))
        const total = cardsOfColumn(board.cards, column.key).length

        return (
          <section
            key={column.key}
            onDragOver={(event) => {
              if (drag === null) return
              event.preventDefault()
              setOver({ column: column.key, index: slot(column.key, null, false) })
            }}
            onDrop={(event) => {
              event.preventDefault()
              drop()
            }}
            className="flex min-w-0 flex-col gap-2 p-[10px]"
            style={{
              borderRadius: 10,
              background: 'color-mix(in srgb, var(--color-surface) 55%, transparent)',
              outline:
                over?.column === column.key
                  ? `1px solid ${tint('var(--color-accent)', 55)}`
                  : '1px solid transparent',
            }}
          >
            <header className="flex items-center gap-2 px-1 pt-1">
              <span
                className="size-[9px] rounded-full"
                style={{ background: column.color, boxShadow: `0 0 10px ${column.color}` }}
              />
              <span style={{ font: '500 13.5px var(--font-body)' }}>{column.label}</span>
              <span className="num" style={{ font: '500 12px var(--mono)', color: 'var(--faint)' }}>
                {search.trim() && list.length !== total ? `${list.length}/${total}` : total}
              </span>
              <span className="flex-1" />
              <button
                type="button"
                title={`Ajouter une carte dans « ${column.label} »`}
                onClick={() => {
                  setEditing(null)
                  setAdding(adding === column.key ? null : column.key)
                }}
                className="hoverable grid size-6 cursor-pointer place-items-center rounded-md border-0 bg-transparent"
                style={{ color: 'var(--muted)' }}
              >
                <Plus size={14} />
              </button>
            </header>

            {adding === column.key && (
              <CardForm
                column={column.key}
                tasks={tasks}
                report={report}
                onSubmit={(input) => {
                  board.create(input)
                  setAdding(null)
                }}
                onCancel={() => setAdding(null)}
              />
            )}

            {list.map((card) =>
              editing === card.id ? (
                <CardForm
                  key={card.id}
                  card={card}
                  column={card.column}
                  tasks={tasks}
                  report={report}
                  onSubmit={(input) => {
                    board.update(card.id, input)
                    setEditing(null)
                  }}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <Card
                  key={card.id}
                  card={card}
                  task={tasks.find((task) => task.id === card.taskId) ?? null}
                  dragged={card.id === drag}
                  onDragStart={() => {
                    setDrag(card.id)
                    setOver({ column: card.column, index: card.position })
                  }}
                  onDragEnd={stop}
                  onDragOver={(after) => {
                    if (drag === null || drag === card.id) return
                    setOver({ column: column.key, index: slot(column.key, card, after) })
                  }}
                  onEdit={() => {
                    setAdding(null)
                    setEditing(card.id)
                  }}
                  onDelete={() => board.destroy(card.id)}
                  onShift={(step) => shift(board.move, card, step)}
                  onOpenTask={onOpenTask}
                />
              )
            )}

            {list.length === 0 && adding !== column.key && (
              <p
                className="m-0 px-2 py-6 text-center"
                style={{
                  font: '400 12.5px/1.5 var(--font-body)',
                  color: 'var(--faint)',
                  borderRadius: 8,
                  outline: `1px dashed ${tint('var(--color-text)', 18)}`,
                }}
              >
                {total === 0 ? 'Rien ici.' : 'Rien ne correspond à la recherche.'}
              </p>
            )}
          </section>
        )
      })}
    </div>
  )
}

/** Au clavier, une carte change de colonne avec les flèches plutôt qu'à la souris. */
function shift(
  move: (id: number, column: KanbanColumnKey, index: number) => void,
  card: KanbanCard,
  step: number
) {
  const at = KANBAN_COLUMNS.findIndex((column) => column.key === card.column)
  const next = KANBAN_COLUMNS[at + step]
  if (next) move(card.id, next.key, Number.MAX_SAFE_INTEGER)
}

interface CardProps {
  card: KanbanCard
  /** La tâche du rapport, quand le ticket cité est encore du périmètre. */
  task: Task | null
  dragged: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onDragOver: (after: boolean) => void
  onEdit: () => void
  onDelete: () => void
  onShift: (step: number) => void
  onOpenTask: (id: string) => void
}

function Card({
  card,
  task,
  dragged,
  onDragStart,
  onDragEnd,
  onDragOver,
  onEdit,
  onDelete,
  onShift,
  onOpenTask,
}: CardProps) {
  /* La suppression se confirme dans la carte : une alerte du navigateur bloquerait la page. */
  const [confirming, setConfirming] = useState(false)
  const first = KANBAN_COLUMNS[0].key === card.column
  const last = KANBAN_COLUMNS[KANBAN_COLUMNS.length - 1].key === card.column

  return (
    <article
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', String(card.id))
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        event.preventDefault()
        event.stopPropagation()
        const box = event.currentTarget.getBoundingClientRect()
        onDragOver(event.clientY > box.top + box.height / 2)
      }}
      className="group flex cursor-grab flex-col gap-[7px] px-3 py-[10px]"
      style={{
        borderRadius: 8,
        background: 'var(--color-surface)',
        boxShadow: 'var(--shadow-sm)',
        opacity: dragged ? 0.45 : 1,
      }}
    >
      <div className="flex items-start gap-2">
        <Ticket card={card} task={task} onOpenTask={onOpenTask} />
        <span className="flex-1" />

        <span className="flex shrink-0 items-center gap-[2px] opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <Action
            icon={ArrowLeft}
            label="Colonne précédente"
            disabled={first}
            onClick={() => onShift(-1)}
          />
          <Action
            icon={ArrowRight}
            label="Colonne suivante"
            disabled={last}
            onClick={() => onShift(1)}
          />
          <Action icon={PencilSimple} label="Modifier la carte" onClick={onEdit} />
          <Action
            icon={Trash}
            label="Supprimer la carte"
            onClick={() => setConfirming(true)}
            color="var(--red)"
          />
        </span>
      </div>

      {card.title && (
        <p className="m-0" style={{ font: '500 13.5px/1.4 var(--font-body)' }}>
          {card.title}
        </p>
      )}

      {(card.branchFront || card.branchBack) && (
        <div className="flex flex-col gap-[3px]">
          {card.branchFront && <Branch side="front" name={card.branchFront} />}
          {card.branchBack && <Branch side="back" name={card.branchBack} />}
        </div>
      )}

      {card.comment && (
        <p
          className="m-0 whitespace-pre-wrap"
          style={{ font: '400 12.5px/1.5 var(--font-body)', color: 'var(--muted)' }}
        >
          {card.comment}
        </p>
      )}

      {confirming && (
        <div
          className="flex items-center gap-2 px-2 py-[6px]"
          style={{
            borderRadius: 6,
            background: tint('var(--red)', 10),
            font: '400 12px var(--font-body)',
          }}
        >
          <span className="flex-1">Supprimer cette carte ?</span>
          <button
            type="button"
            onClick={onDelete}
            className="btn btn-secondary"
            style={{ fontSize: 12, padding: '2px 8px', color: 'var(--red)' }}
          >
            Supprimer
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="btn btn-secondary"
            style={{ fontSize: 12, padding: '2px 8px' }}
          >
            Annuler
          </button>
        </div>
      )}
    </article>
  )
}

/**
 * La référence du ticket, et ce qu'on peut en faire.
 *
 * Si la tâche est dans le rapport du jour, sa fiche s'ouvre sur place — c'est
 * la règle du tableau, on ne part pas dans un onglet pour lire un ticket. Sinon
 * il reste le lien ClickUp, parce qu'une carte survit au périmètre qui l'a vue
 * naître.
 */
function Ticket({
  card,
  task,
  onOpenTask,
}: {
  card: KanbanCard
  task: Task | null
  onOpenTask: (id: string) => void
}) {
  if (!card.ref) return null

  if (task) {
    return (
      <button
        type="button"
        onClick={() => onOpenTask(task.id)}
        title={`${task.ref} — ${task.name}`}
        className="hoverable cursor-pointer rounded border-0 bg-transparent px-1 py-[1px]"
        style={REF}
      >
        {card.ref}
      </button>
    )
  }

  if (card.url) {
    return (
      <a
        href={card.url}
        target="_blank"
        rel="noreferrer"
        title="Ouvrir dans ClickUp — ce ticket n’est pas dans le rapport du jour"
        className="flex items-center gap-1 px-1 py-[1px]"
        style={REF}
      >
        {card.ref}
        <ArrowSquareOut size={11} />
      </a>
    )
  }

  return (
    <span className="px-1 py-[1px]" style={REF}>
      {card.ref}
    </span>
  )
}

/** Une branche : cliquée, elle part dans le presse-papiers, prête à être checkout. */
function Branch({ side, name }: { side: 'front' | 'back'; name: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(name)
      setCopied(true)
      timer.current = setTimeout(() => setCopied(false), 1400)
    } catch {
      /* Pas de presse-papiers (page non sécurisée, permission refusée) : tant pis. */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={`Copier « ${name} »`}
      className="hoverable flex w-full cursor-pointer items-center gap-[6px] rounded border-0 bg-transparent px-1 py-[2px] text-left"
      style={{ color: 'var(--muted)' }}
    >
      {copied ? (
        <Check size={12} color="var(--green)" className="shrink-0" />
      ) : (
        <GitBranch size={12} className="shrink-0" />
      )}
      <span
        className="shrink-0"
        style={{
          font: '500 10px var(--font-body)',
          letterSpacing: '.06em',
          textTransform: 'uppercase',
          color: 'var(--faint)',
        }}
      >
        {side}
      </span>
      <span className="truncate" style={{ font: '400 12px var(--mono)' }}>
        {name}
      </span>
    </button>
  )
}

function Action({
  icon: Glyph,
  label,
  onClick,
  disabled,
  color,
}: {
  icon: Icon
  label: string
  onClick: () => void
  disabled?: boolean
  color?: string
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="hoverable grid size-[22px] place-items-center rounded border-0 bg-transparent disabled:opacity-30"
      style={{ color: color ?? 'var(--muted)', cursor: disabled ? 'default' : 'pointer' }}
    >
      <Glyph size={13} />
    </button>
  )
}

const EMPTY = {
  ref: '',
  taskId: '',
  title: '',
  url: '',
  branchFront: '',
  branchBack: '',
  comment: '',
}

interface CardFormProps {
  /** La carte modifiée, ou rien du tout quand on en crée une. */
  card?: KanbanCard
  column: KanbanColumnKey
  tasks: Task[]
  report: Report | null
  onSubmit: (input: KanbanCardInput) => void
  onCancel: () => void
}

/**
 * Le formulaire d'une carte, à la création comme à la modification.
 *
 * Taper une référence connue remplit le reste : l'intitulé prend le nom du
 * ticket s'il est encore vide, et les branches que la collecte a trouvées sur
 * ce ticket se posent en un clic, du bon côté quand le nom du dépôt le dit.
 */
function CardForm({ card, column, tasks, report, onSubmit, onCancel }: CardFormProps) {
  const [draft, setDraft] = useState<Omit<KanbanCardInput, 'column'>>(() =>
    card
      ? {
          ref: card.ref,
          taskId: card.taskId,
          title: card.title,
          url: card.url,
          branchFront: card.branchFront,
          branchBack: card.branchBack,
          comment: card.comment,
        }
      : { ...EMPTY }
  )
  const field = useRef<HTMLInputElement>(null)
  const id = useId()

  useEffect(() => field.current?.focus(), [])

  const task = findTask(tasks, draft.ref)
  const local = task && report ? (report.branches[task.id] ?? []) : []
  const suggestions = branchSuggestions(report, task?.id ?? draft.taskId)
  const ready = Boolean(draft.ref.trim() || draft.title.trim())

  const set = (patch: Partial<typeof draft>) => setDraft((current) => ({ ...current, ...patch }))

  /* Un ticket reconnu apporte son identifiant, son lien, et son nom si rien n'est écrit. */
  const onRef = (value: string) => {
    const found = findTask(tasks, value)
    set({
      ref: value,
      taskId: found?.id ?? '',
      url: found?.url ?? '',
      title: !draft.title.trim() && found ? found.name : draft.title,
    })
  }

  /* Une branche proposée va du côté que son dépôt suggère, sinon dans le champ libre. */
  const take = (repo: string, name: string) => {
    const side = sideOf(repo) ?? (draft.branchFront ? 'back' : 'front')
    set(side === 'front' ? { branchFront: name } : { branchBack: name })
  }

  const submit = () => {
    if (!ready) return
    onSubmit({ ...draft, column })
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          /* La page écoute Échap pour vider la recherche : il s'arrête ici. */
          event.stopPropagation()
          onCancel()
        }
        /* Entrée valide depuis n'importe quel champ, y compris le commentaire. */
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submit()
      }}
      className="flex flex-col gap-[6px] px-3 py-[10px]"
      style={{
        borderRadius: 8,
        background: 'var(--color-surface)',
        boxShadow: `0 0 0 1px ${tint('var(--color-accent)', 55)}`,
      }}
    >
      <datalist id={`${id}-tickets`}>
        {tasks.map((entry) => (
          <option key={entry.id} value={entry.ref}>
            {entry.name}
          </option>
        ))}
      </datalist>
      <datalist id={`${id}-branches`}>
        {suggestions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <input
        ref={field}
        className="input"
        style={{ minHeight: 30, fontFamily: 'var(--mono)', fontSize: 12.5 }}
        list={`${id}-tickets`}
        placeholder="Ticket (ROC-1801)"
        value={draft.ref}
        onChange={(event) => onRef(event.target.value)}
      />
      {task && (
        <span
          className="truncate px-1"
          style={{ font: '400 11.5px var(--font-body)', color: 'var(--green)' }}
        >
          {task.name}
        </span>
      )}

      <input
        className="input"
        style={{ minHeight: 30, fontSize: 12.5 }}
        placeholder="Intitulé"
        value={draft.title}
        onChange={(event) => set({ title: event.target.value })}
      />

      <div className="grid grid-cols-2 gap-[6px]">
        <input
          className="input"
          style={{ minHeight: 30, fontFamily: 'var(--mono)', fontSize: 12 }}
          list={`${id}-branches`}
          placeholder="branche front"
          value={draft.branchFront}
          onChange={(event) => set({ branchFront: event.target.value })}
        />
        <input
          className="input"
          style={{ minHeight: 30, fontFamily: 'var(--mono)', fontSize: 12 }}
          list={`${id}-branches`}
          placeholder="branche back"
          value={draft.branchBack}
          onChange={(event) => set({ branchBack: event.target.value })}
        />
      </div>

      {local.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 px-1">
          <span style={{ font: '400 11px var(--font-body)', color: 'var(--faint)' }}>
            trouvées en local :
          </span>
          {local.map((branch) => (
            <button
              key={`${branch.repo}/${branch.name}`}
              type="button"
              onClick={() => take(branch.repo, branch.name)}
              title={`${branch.repo} · ${branch.name}`}
              className="tag hoverable max-w-full cursor-pointer border-0"
              style={{ background: 'var(--soft)', color: 'var(--muted)', fontSize: 10.5 }}
            >
              <span className="truncate" style={{ fontFamily: 'var(--mono)' }}>
                {branch.name}
              </span>
            </button>
          ))}
        </div>
      )}

      <textarea
        className="input"
        rows={2}
        style={{ fontSize: 12.5, lineHeight: 1.45, resize: 'vertical' }}
        placeholder="Commentaire — où on en est, ce qu'on attend"
        value={draft.comment}
        onChange={(event) => set({ comment: event.target.value })}
      />

      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!ready}
          style={{ fontSize: 12 }}
        >
          <Check size={13} />
          {card ? 'Enregistrer' : 'Ajouter'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary"
          style={{ fontSize: 12 }}
        >
          <X size={13} />
          Annuler
        </button>
      </div>
    </form>
  )
}

/**
 * De quel côté une branche tombe, d'après le nom de son dépôt.
 *
 * Une devinette, et elle se corrige d'un clic : le pire qu'elle risque est de
 * proposer « front » là où on voulait « back ».
 */
function sideOf(repo: string): 'front' | 'back' | null {
  const name = repo.toLowerCase()
  if (/front|web|ui|client|app/.test(name)) return 'front'
  if (/back|api|server|srv|core/.test(name)) return 'back'
  return null
}
