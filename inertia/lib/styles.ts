import type { CSSProperties } from 'react'

/*
| Les habits partagés par toutes les cartes.
|
| Ils sont écrits une fois ici plutôt que recopiés dans six composants : c'est
| ce qui garantit qu'une carte ajoutée demain a exactement le même fond, le
| même filet et le même intitulé que les autres.
|
| La maquette n'a qu'une seule carte : blanche, filet d'un pixel, coins à
| 12 px — et, quand elle parle de quelque chose de coloré, un liseré de 3 px
| à gauche qui en porte la couleur. `CARD` est la carte nue ; celle à liseré
| est le composant `Card`, qui porte en plus son intitulé et son glyphe.
*/

/** Le fond d'une carte : surface, filet, coins à 12 px. */
export const CARD: CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-divider)',
  borderRadius: 12,
  boxShadow: 'var(--shadow-card)',
  padding: '16px 20px 18px',
}

/** L'intitulé d'une carte : petites capitales espacées, jamais du gras noir. */
export const KICKER: CSSProperties = {
  font: '600 10.5px var(--font-body)',
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  color: 'var(--muted)',
}

/** La référence d'un ticket : toujours en chasse fixe, toujours en accent. */
export const REF: CSSProperties = {
  font: '600 11.5px var(--mono)',
  color: 'var(--ref)',
  flex: 'none',
}
