/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  // Node
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  // App
  APP_KEY: Env.schema.secret(),
  APP_URL: Env.schema.string({ format: 'url', tld: false }),

  // Session
  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory', 'database'] as const),

  // Base SQLite, dans tmp/ — les tests en utilisent une autre (voir .env.test)
  DB_FILENAME: Env.schema.string.optional(),

  // ClickUp — jeton personnel (https://app.clickup.com/settings/apps)
  CLICKUP_API_TOKEN: Env.schema.secret(),
  CLICKUP_TEAM_ID: Env.schema.string.optional(),

  // Transcriptions Claude Code — à renseigner en conteneur, où ~ n'est pas le bon home
  CLAUDE_TRANSCRIPTS_PATH: Env.schema.string.optional(),
})
