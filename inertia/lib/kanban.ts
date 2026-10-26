import { useCallback, useMemo, useRef, useState } from 'react'
import { router } from '@inertiajs/react'
import { moveCard, sortCards } from '#domain/kanban'
import type { KanbanCard, KanbanCardInput, KanbanColumnKey } from '#domain/kanban'
import type { Task } from '@/lib/report'

export type { KanbanCard, KanbanCardInput, KanbanColumnKey }

/*
| LE TABLEAU PERSONNEL, VU DU NAVIGATEUR.
|
| Une carte lâchée dans une colonne doit y être AVANT que le serveur réponde :
| un tableau qui attend un aller-retour pour redessiner se manipule mal. Un
| calque local porte donc le geste tant que l'écriture est en vol, et s'efface
| dès qu'elle est retombée — comme les préférences de projets s'appliquent à
| l'écran sans attendre leur enregistrement, et pour la même raison.
|
| Le déplacement lui-même vient du domaine : l'écran et la base rangent les
| cartes avec la même fonction.
*/

const VISIT = { preserveScroll: true, preserveState: true } as const

export interface KanbanControls {
  cards: KanbanCard[]
  create: (input: KanbanCardInput) => void
  update: (id: number, input: KanbanCardInput) => void
  move: (id: number, column: KanbanColumnKey, index: number) => void
  destroy: (id: number) => void
}

export function useKanban(initial: KanbanCard[]): KanbanControls {
  /*
   * Un calque, pas une copie.
   *
   * Tant qu'une écriture est en vol, l'écran lit ce calque — la carte est donc
   * déjà posée où on l'a lâchée. Dès que tout est retombé, le calque est
   * retiré et les props redeviennent la vérité : une écriture refusée se
   * corrige d'elle-même, sans qu'on ait à deviner ce que le serveur a fait.
   */
  const [local, setLocal] = useState<KanbanCard[] | null>(null)
  const pending = useRef(0)

  const cards = useMemo(() => local ?? sortCards(initial), [local, initial])

  const send = useCallback((visit: (options: Record<string, unknown>) => void) => {
    pending.current += 1
    visit({
      ...VISIT,
      onFinish: () => {
        pending.current -= 1
        if (pending.current === 0) setLocal(null)
      },
    })
  }, [])

  return useMemo(
    () => ({
      cards,

      create(input: KanbanCardInput) {
        /* Rien d'optimiste ici : seul le serveur sait quel identifiant la carte prend. */
        send((options) => router.post('/kanban', input as never, options))
      },

      update(id: number, input: KanbanCardInput) {
        setLocal(cards.map((card) => (card.id === id ? { ...card, ...input } : card)))
        send((options) => router.put(`/kanban/${id}`, input as never, options))
      },

      move(id: number, column: KanbanColumnKey, index: number) {
        setLocal(moveCard(cards, id, column, index))
        send((options) => router.put(`/kanban/${id}/move`, { column, index } as never, options))
      },

      destroy(id: number) {
        setLocal(cards.filter((card) => card.id !== id))
        send((options) => router.delete(`/kanban/${id}`, options))
      },
    }),
    [cards, send]
  )
}

/** Ce qu'une carte laisse chercher : sa référence, son intitulé, ses branches, sa note. */
export function matchesCard(card: KanbanCard, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true

  const haystack = [card.ref, card.title, card.branchFront, card.branchBack, card.comment]
    .join(' ')
    .toLowerCase()

  return needle.split(/\s+/).every((word) => haystack.includes(word))
}

/**
 * Le ticket désigné par ce qu'on a tapé.
 *
 * La référence suffit — c'est elle qu'on recopie d'un nom de branche ou d'un
 * canal Slack — et l'identifiant ClickUp est accepté aussi, parce que c'est ce
 * que porte une carte posée depuis le tableau.
 */
export function findTask(tasks: Task[], typed: string): Task | null {
  const needle = typed.trim().toLowerCase()
  if (!needle) return null

  return (
    tasks.find((task) => task.ref.toLowerCase() === needle || task.id.toLowerCase() === needle) ??
    null
  )
}
