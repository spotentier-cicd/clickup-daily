import { formatDateTime } from '@/lib/format'
import type { Report } from '@/lib/report'

/** Ce qui a bougé depuis le rapport de référence — le dernier run planifié. */
export function ChangesSection({ diff }: { diff: Report['diff'] }) {
  const count =
    diff.entered.length + diff.statusChanged.length + diff.left.length + diff.assignedToMe.length

  if (!diff.since) {
    return (
      <section className="rounded-lg border p-4">
        <h2 className="text-sm font-semibold">
          <span aria-hidden>🔔</span> Changements
        </h2>
        <p className="mt-2 text-xs text-muted-foreground">
          Premier rapport : il n’y a rien à quoi comparer.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-lg border p-4">
      <h2 className="flex items-baseline gap-2 text-sm font-semibold">
        <span aria-hidden>🔔</span> Changements
        <span className="ml-auto text-xs font-normal text-muted-foreground">
          depuis le {formatDateTime(diff.since)}
        </span>
      </h2>

      {count === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">Rien n’a bougé.</p>
      ) : (
        <div className="mt-3 space-y-3 text-xs">
          <Group title="M’ont été assignées" items={diff.assignedToMe.map(label)} tone="accent" />
          <Group title="Entrées" items={diff.entered.map(label)} />
          <Group
            title="Changements de statut"
            items={diff.statusChanged.map(
              (c) => `${c.task.ref} · ${c.previousStatus} → ${c.task.status}`
            )}
          />
          <Group
            title="Sorties"
            items={diff.left.map((l) => `${l.snapshot.ref} → ${l.newStatus}`)}
          />
        </div>
      )}
    </section>
  )
}

function label(task: { ref: string; name: string }): string {
  return `${task.ref} · ${task.name}`
}

function Group({ title, items, tone }: { title: string; items: string[]; tone?: 'accent' }) {
  if (items.length === 0) return null

  return (
    <div>
      <h3 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {title} <span className="tabular-nums">({items.length})</span>
      </h3>
      <ul className={tone === 'accent' ? 'mt-1 space-y-0.5 font-medium' : 'mt-1 space-y-0.5'}>
        {items.map((item, index) => (
          <li key={index} className="truncate">
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
