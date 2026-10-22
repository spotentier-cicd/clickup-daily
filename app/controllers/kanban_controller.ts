import { inject } from '@adonisjs/core'
import vine from '@vinejs/vine'
import { KanbanRepository } from '#services/kanban_repository'
import { cardLabel, isCardEmpty, sanitizeCardInput, toKanbanColumn } from '#domain/kanban'
import type { HttpContext } from '@adonisjs/core/http'

/*
| Le validateur ne dit que la FORME : des chaînes, et rien d'autre. Ce qui
| constitue une carte valable — longueurs, colonne connue, lien ouvrable — vit
| dans le domaine, et sert aussi bien à la création qu'à la modification.
*/
const cardValidator = vine.compile(
  vine.object({
    column: vine.string(),
    ref: vine.string().optional(),
    taskId: vine.string().optional(),
    title: vine.string().optional(),
    url: vine.string().optional(),
    branchFront: vine.string().optional(),
    branchBack: vine.string().optional(),
    comment: vine.string().optional(),
  })
)

const moveValidator = vine.compile(
  vine.object({
    column: vine.string(),
    index: vine.number().min(0),
  })
)

/**
 * Le tableau personnel.
 *
 * Seul endroit du projet qui écrit ce que l'utilisateur a tapé — le reste ne
 * fait que relire ClickUp. Chaque action renvoie sur la page d'où elle vient :
 * la carte est déjà déplacée à l'écran quand la réponse arrive, et ce
 * retour-là ne sert qu'à confirmer.
 */
export default class KanbanController {
  @inject()
  async store({ request, response, session }: HttpContext, cards: KanbanRepository) {
    const input = sanitizeCardInput(await request.validateUsing(cardValidator))

    if (isCardEmpty(input)) {
      session.flash('error', 'Une carte demande au moins un ticket ou un intitulé.')
      return response.redirect().back()
    }

    await cards.create(input)
    return response.redirect().back()
  }

  @inject()
  async update({ request, response, session, params }: HttpContext, cards: KanbanRepository) {
    const input = sanitizeCardInput(await request.validateUsing(cardValidator))

    if (isCardEmpty(input)) {
      session.flash('error', 'Une carte demande au moins un ticket ou un intitulé.')
      return response.redirect().back()
    }

    const card = await cards.update(Number(params.id), input)
    if (!card) session.flash('error', 'Cette carte n’existe plus.')

    return response.redirect().back()
  }

  /** Glissée dans une autre colonne, ou remontée dans la sienne. */
  @inject()
  async move({ request, response, session, params }: HttpContext, cards: KanbanRepository) {
    const { column, index } = await request.validateUsing(moveValidator)

    const done = await cards.move(Number(params.id), toKanbanColumn(column), index)
    if (!done) session.flash('error', 'Cette carte n’existe plus.')

    return response.redirect().back()
  }

  @inject()
  async destroy({ response, session, params }: HttpContext, cards: KanbanRepository) {
    const card = await cards
      .all()
      .then((all) => all.find((entry) => entry.id === Number(params.id)))
    const done = await cards.destroy(Number(params.id))

    if (done && card) session.flash('success', `Carte supprimée : ${cardLabel(card)}`)
    return response.redirect().back()
  }
}
