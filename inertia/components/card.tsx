import { type CSSProperties, type ReactNode } from 'react'
import { cn } from 'cn'
import type { Icon } from '@phosphor-icons/react'

/*
| LA CARTE.
|
| La maquette n'en a qu'une, et toute la page est faite avec : un fond blanc,
| un filet d'un pixel, un liseré de 3 px à gauche qui porte la couleur de ce
| dont elle parle, et un grand glyphe pâle en haut à droite qui la rend
| reconnaissable de loin sans rien peser dans la lecture.
|
| L'écrire une fois ici plutôt que six fois en ligne, c'est ce qui garantit
| qu'une carte ajoutée demain a le même liseré, le même intitulé et le même
| glyphe que les autres — et qu'un changement de rayon se fait à un endroit.
*/

interface CardProps {
  /** La couleur du liseré et du glyphe. L'accent par défaut. */
  rail?: string
  /** Le glyphe pâle du coin : il identifie la carte, il n'informe pas. */
  mark?: Icon
  /** L'intitulé, en petites capitales. */
  kicker: ReactNode
  /** Le compte qui va avec l'intitulé, en pastille pleine. */
  count?: number
  /** La phrase qui dit de quoi parle la carte, sous l'intitulé. */
  note?: ReactNode
  className?: string
  children: ReactNode
}

export function Card({
  rail = 'var(--color-accent)',
  mark: Mark,
  kicker,
  count,
  note,
  className,
  children,
}: CardProps) {
  return (
    <section className={cn('card-rail', className)} style={{ '--rail': rail } as CSSProperties}>
      <div className="flex items-start gap-3 pr-10">
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className="flex items-center gap-[6px]">
            <span className="kicker">{kicker}</span>
            {count !== undefined && <span className="pip num">{count}</span>}
          </span>
          {note && (
            <span style={{ font: '500 11.5px var(--font-body)', color: 'var(--muted)' }}>
              {note}
            </span>
          )}
        </div>
      </div>

      {Mark && (
        <span className="card-mark" aria-hidden>
          <Mark size={30} weight="regular" />
        </span>
      )}

      {children}
    </section>
  )
}
