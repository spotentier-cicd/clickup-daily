import { Badge } from '@/components/ui/badge'
import type { Blocker } from '@/lib/report'

/**
 * « À débloquer en premier », ordonné par ce que coûte le fait de l'ignorer
 * aujourd'hui — ce qui bloque quelqu'un d'autre avant ce qui ne bloque que moi.
 */
export function BlockersSection({ blockers, maxItems }: { blockers: Blocker[]; maxItems: number }) {
  if (blockers.length === 0) return null

  const shown = blockers.slice(0, maxItems)
  const hidden = blockers.length - shown.length

  return (
    <section className="rounded-lg border border-red-500/25 bg-red-500/[0.04] p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <span aria-hidden>🚨</span> À débloquer en premier
        <Badge variant="secondary" className="tabular-nums">
          {blockers.length}
        </Badge>
      </h2>

      <ol className="mt-3 space-y-2.5">
        {shown.map((blocker) => (
          <li key={blocker.task.id} className="text-sm">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <a
                href={blocker.task.url}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs font-semibold text-primary hover:underline"
              >
                {blocker.task.ref}
              </a>
              <span className="font-medium">{blocker.task.name}</span>
              <span className="text-xs text-muted-foreground">
                {blocker.task.envLabel} · {blocker.task.columnLabel}
              </span>
            </div>
            <ul className="mt-0.5 space-y-0.5 text-xs text-muted-foreground">
              {blocker.reasons.map((reason, index) => (
                <li key={index}>{reason}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      {hidden > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          et {hidden} autre{hidden > 1 ? 's' : ''} — relevez blockers.maxItems pour les voir.
        </p>
      )}
    </section>
  )
}
