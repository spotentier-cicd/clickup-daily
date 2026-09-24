/** Échec d'un appel à l'API ClickUp, avec un message destiné à l'utilisateur. */
export class ClickUpError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message)
    this.name = 'ClickUpError'
  }
}
