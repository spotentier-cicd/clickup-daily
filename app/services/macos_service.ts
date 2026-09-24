import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

/** Notification macOS. Un échec ne doit jamais faire échouer la collecte. */
export async function notify(title: string, message: string): Promise<void> {
  const escape = (text: string) => text.replace(/["\\]/g, '\\$&')
  try {
    await run('osascript', [
      '-e',
      `display notification "${escape(message)}" with title "${escape(title)}"`,
    ])
  } catch {
    /* Pas de notification : ce n'est pas une raison d'interrompre le rapport. */
  }
}
