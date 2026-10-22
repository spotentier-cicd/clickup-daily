import db from '@adonisjs/lucid/services/db'
import KanbanCard from '#models/kanban_card'
import {
  cardsOfColumn,
  moveCard,
  nextPosition,
  sanitizeCardInput,
  sortCards,
  toKanbanColumn,
} from '#domain/kanban'
import type { KanbanCard as Card, KanbanCardInput, KanbanColumnKey } from '#domain/kanban'

/**
 * Les cartes du tableau personnel.
 *
 * Le rangement est recalculé à l'écriture, jamais à la lecture : la colonne
 * arrive déjà triée et renumérotée. C'est ce qui permet à la page de lâcher
 * une carte, de la redessiner tout de suite avec la fonction du domaine, et de
 * retrouver exactement la même chose au rechargement.
 */
export class KanbanRepository {
  async all(): Promise<Card[]> {
    const rows = await KanbanCard.query().orderBy('position', 'asc').orderBy('id', 'asc')
    return sortCards(rows.map(toCard))
  }

  /** Pose une carte au bas de sa colonne. */
  async create(input: KanbanCardInput): Promise<Card> {
    const clean = sanitizeCardInput(input)
    const cards = await this.all()

    const row = await KanbanCard.create({
      columnKey: clean.column,
      position: nextPosition(cards, clean.column),
      ref: clean.ref,
      taskId: clean.taskId,
      title: clean.title,
      url: clean.url,
      branchFront: clean.branchFront,
      branchBack: clean.branchBack,
      comment: clean.comment,
    })

    return toCard(row)
  }

  /**
   * Réécrit une carte.
   *
   * La colonne fait partie des champs modifiables — on peut corriger « en
   * cours » en « bloqué » depuis le formulaire — et un changement de colonne
   * repose la carte au bas de la nouvelle : son ancien rang n'y voudrait rien
   * dire.
   */
  async update(id: number, input: KanbanCardInput): Promise<Card | null> {
    const row = await KanbanCard.find(id)
    if (!row) return null

    const clean = sanitizeCardInput(input)
    const previous = toKanbanColumn(row.columnKey)
    const moved = previous !== clean.column

    row.merge({
      columnKey: clean.column,
      position: moved ? nextPosition(await this.all(), clean.column) : row.position,
      ref: clean.ref,
      taskId: clean.taskId,
      title: clean.title,
      url: clean.url,
      branchFront: clean.branchFront,
      branchBack: clean.branchBack,
      comment: clean.comment,
    })
    await row.save()

    /* Le trou est dans la colonne QUITTÉE, pas dans celle d'arrivée. */
    if (moved) await this.#renumber(previous)
    return toCard(row)
  }

  /** Déplace une carte : la colonne visée, et le rang qu'elle y prend. */
  async move(id: number, column: KanbanColumnKey, index: number): Promise<boolean> {
    const cards = await this.all()
    if (!cards.some((card) => card.id === id)) return false

    const placed = moveCard(cards, id, column, index)
    const changed = placed.filter((card) => {
      const before = cards.find((entry) => entry.id === card.id)!
      return before.column !== card.column || before.position !== card.position
    })
    if (changed.length === 0) return true

    /* Tout ou rien : un rangement à moitié écrit se verrait au rechargement. */
    await db.transaction(async (trx) => {
      for (const card of changed) {
        await KanbanCard.query({ client: trx })
          .where('id', card.id)
          .update({ column_key: card.column, position: card.position })
      }
    })

    return true
  }

  async destroy(id: number): Promise<boolean> {
    const row = await KanbanCard.find(id)
    if (!row) return false

    const column = toKanbanColumn(row.columnKey)
    await row.delete()
    await this.#renumber(column)

    return true
  }

  /** Referme le trou laissé par une carte partie d'une colonne. */
  async #renumber(column: KanbanColumnKey): Promise<void> {
    const cards = cardsOfColumn(await this.all(), column)

    await db.transaction(async (trx) => {
      for (const [rank, card] of cards.entries()) {
        if (card.position === rank) continue
        await KanbanCard.query({ client: trx }).where('id', card.id).update({ position: rank })
      }
    })
  }
}

/** Une ligne telle que la page la reçoit : colonne validée, dates en ISO. */
function toCard(row: KanbanCard): Card {
  return {
    id: row.id,
    column: toKanbanColumn(row.columnKey),
    position: row.position,
    ref: row.ref,
    taskId: row.taskId,
    title: row.title,
    url: row.url,
    branchFront: row.branchFront,
    branchBack: row.branchBack,
    comment: row.comment,
    createdAt: row.createdAt?.toISO() ?? null,
    updatedAt: row.updatedAt?.toISO() ?? null,
  }
}
