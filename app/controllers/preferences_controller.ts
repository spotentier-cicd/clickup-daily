import { inject } from '@adonisjs/core'
import vine from '@vinejs/vine'
import { PreferencesRepository } from '#services/preferences_repository'
import type { HttpContext } from '@adonisjs/core/http'

const projectsValidator = vine.compile(
  vine.object({
    hiddenEnvironments: vine.array(vine.string()),
    hiddenLists: vine.array(vine.string()),
    environmentOrder: vine.array(vine.string()),
    hiddenFields: vine.array(vine.string()),
  })
)

export default class PreferencesController {
  /** Enregistre le choix des projets affichés. */
  @inject()
  async update({ request, response }: HttpContext, preferences: PreferencesRepository) {
    const payload = await request.validateUsing(projectsValidator)
    await preferences.saveProjects(payload)

    return response.redirect().back()
  }
}
