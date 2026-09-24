import { useEffect, useRef } from 'react'
import { X } from '@phosphor-icons/react'
import { TaskDetailContent } from '@/components/task_detail'
import type { DressedTask } from '@/lib/board'
import type { ReportColumn } from '@/lib/report'

/*
| LE DÉTAIL EN SUPERPOSITION.
|
| Un ticket cliqué s'ouvre ICI, pas dans un onglet de navigateur. C'est la même
| fiche que le panneau de droite — même composant de contenu — mais posée
| au-dessus de la page, parce que la synthèse du matin n'a pas de liste à côté
| de laquelle la loger.
|
| ClickUp reste à un clic : le bouton « Ouvrir dans ClickUp » est au bas de la
| fiche, et c'est le seul endroit qui quitte l'application.
|
| Contrairement au reste du front, ce composant est correct au clavier : rôle
| de dialogue, focus déplacé dedans à l'ouverture et rendu à l'élément
| d'origine à la fermeture, Échap et clic sur le fond pour refermer. Un panneau
| qui recouvre la page ne peut pas se permettre de piéger la navigation.
*/

interface TaskSheetProps {
  dressed: DressedTask
  column: ReportColumn | undefined
  onClose: () => void
}

export function TaskSheet({ dressed, column, onClose }: TaskSheetProps) {
  const panel = useRef<HTMLDivElement>(null)
  const closer = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    /* D'où l'on vient : le focus y retourne à la fermeture. */
    const origin = document.activeElement as HTMLElement | null
    closer.current?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }

      /*
       * Le focus reste dans la fiche : sans ça, tabuler emmènerait derrière le
       * voile, sur des éléments qu'on ne voit pas.
       */
      if (event.key !== 'Tab' || !panel.current) return

      const focusable = panel.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
      )
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      origin?.focus?.()
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: 'color-mix(in srgb, var(--color-neutral-900) 55%, transparent)' }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={`${dressed.task.ref} — ${dressed.task.name}`}
        tabIndex={-1}
        className="flex h-full w-[min(520px,100vw)] flex-col gap-[14px] overflow-auto px-6 pt-5 pb-8"
        style={{
          background: dressed.mine ? 'var(--mine)' : 'var(--color-surface)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <button
          ref={closer}
          type="button"
          onClick={onClose}
          aria-label="Fermer la fiche"
          className="hoverable -mt-1 -mr-2 grid size-8 shrink-0 cursor-pointer place-items-center self-end rounded-md border-0 bg-transparent"
          style={{ color: 'var(--muted)' }}
        >
          <X size={16} />
        </button>

        <TaskDetailContent dressed={dressed} column={column} />
      </div>
    </div>
  )
}
