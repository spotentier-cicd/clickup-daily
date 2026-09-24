import type { CSSProperties } from 'react'

/*
| Les trois habits partagés par toutes les cartes de la synthèse.
|
| Ils sont écrits une fois ici plutôt que recopiés dans six composants : c'est
| ce qui garantit qu'une carte ajoutée demain a exactement le même fond, la
| même ombre et le même intitulé que les autres.
*/

/** Le fond d'une carte : surface, coins doux, filet d'ombre. */
export const CARD: CSSProperties = {
  background: 'var(--color-surface)',
  borderRadius: 8,
  boxShadow: 'var(--shadow-sm)',
  padding: '16px 18px 18px',
}

/** L'intitulé d'une carte : petites capitales espacées, jamais du gras noir. */
export const KICKER: CSSProperties = {
  font: '500 12px var(--font-body)',
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  color: 'var(--muted)',
}

/** La référence d'un ticket : toujours en chasse fixe, toujours en accent. */
export const REF: CSSProperties = {
  font: '500 11.5px var(--mono)',
  color: 'var(--ref)',
  flex: 'none',
}
