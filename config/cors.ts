import { defineConfig } from '@adonisjs/cors'

/**
 * Configuration options to tweak the CORS policy. The following
 * options are documented on the official documentation website.
 *
 * https://docs.adonisjs.com/guides/security/cors
 */
const corsConfig = defineConfig({
  /*
   * CORS désactivé, en développement comme ailleurs.
   *
   * Ce serveur ne sert qu'une application Inertia de même origine : aucune
   * page tierce n'a de raison légitime de l'appeler. L'activer laissait
   * `origin: true` en développement — le mode nominal d'après le README —
   * avec `credentials: true`, sur des routes sans authentification : n'importe
   * quel onglet ouvert pouvait lire le rapport complet, titres, descriptions,
   * commentaires et pointage compris. Le CSRF de Shield ne couvre que les
   * écritures, pas la lecture.
   */
  enabled: false,

  origin: [],

  /**
   * HTTP methods accepted for cross-origin requests.
   */
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE'],

  /**
   * Reflect request headers by default. Use a string array to restrict
   * allowed headers.
   */
  headers: true,

  /**
   * Response headers exposed to the browser.
   */
  exposeHeaders: [],

  /**
   * Allow cookies/authorization headers on cross-origin requests.
   */
  credentials: true,

  /**
   * Cache CORS preflight response for N seconds.
   */
  maxAge: 90,
})

export default corsConfig
