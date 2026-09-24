import {
  CalendarX,
  ChatCircleDots,
  Eye,
  GitBranch,
  HourglassLow,
  Package,
  WarningCircle,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'

/*
| LA RAISON D'UN BLOCAGE, HABILLÉE.
|
| computeBlockers écrit ses raisons en toutes lettres, préfixées d'un
| pictogramme : « 👀 attend une relecture depuis 7 j ». Le préfixe est le seul
| point de contact entre la règle et son affichage — on le troque ici contre un
| glyphe du système et une couleur, plutôt que de faire remonter un `kind`
| jusque dans le domaine et ses tests.
|
| RÈGLE DE COULEUR : rouge ce qui bloque quelqu'un ou qui a dépassé une date,
| ambre ce qui traîne. Ça traîne n'est pas ça brûle.
*/

type Dressing = { icon: Icon; color: string }

const BY_PREFIX: Record<string, Dressing> = {
  '📌': { icon: ChatCircleDots, color: 'var(--red)' },
  '⏰': { icon: CalendarX, color: 'var(--red)' },
  '👀': { icon: Eye, color: 'var(--red)' },
  '🔀': { icon: GitBranch, color: 'var(--amber)' },
  '🕸️': { icon: HourglassLow, color: 'var(--amber)' },
  '📦': { icon: Package, color: 'var(--amber)' },
}

export type DressedReason = { icon: Icon; color: string; text: string }

/** La raison sans son pictogramme, plus le glyphe et la couleur qui vont avec. */
export function dressReason(reason: string): DressedReason {
  for (const [prefix, dressing] of Object.entries(BY_PREFIX)) {
    if (reason.startsWith(prefix)) {
      return { ...dressing, text: reason.slice(prefix.length).trim() }
    }
  }

  /* Une raison sans préfixe connu reste lisible : elle ne disparaît pas. */
  return { icon: WarningCircle, color: 'var(--muted)', text: reason }
}
