import type { DateTime } from 'luxon'

/** Un commentaire qui me cite ou qui m'est assigné. */
export type MentionOf<D> = {
  taskId: string
  author: string
  when: D | null
  text: string
  /** Assigné à moi : ça attend une action, pas juste une lecture. */
  assigned: boolean
  resolved: boolean
  /** Apparu depuis le rapport précédent. */
  isNew: boolean
}

export type Mention = MentionOf<DateTime>
