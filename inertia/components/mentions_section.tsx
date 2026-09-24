import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/format'
import type { Mention } from '@/lib/report'

/** Les commentaires qui me citent ou qui m'ont été assignés. */
export function MentionsSection({ mentions }: { mentions: Mention[] }) {
  if (mentions.length === 0) return null

  return (
    <section className="rounded-lg border p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <span aria-hidden>💬</span> On me parle
        <Badge variant="secondary" className="tabular-nums">
          {mentions.length}
        </Badge>
      </h2>

      <ul className="mt-3 space-y-2.5">
        {mentions.map(({ mention, task }, index) => (
          <li key={index} className="text-sm">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <a
                href={task.url}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs font-semibold text-primary hover:underline"
              >
                {task.ref}
              </a>
              <span className="text-xs font-medium">{mention.author}</span>
              <span className="text-xs text-muted-foreground">{formatDateTime(mention.when)}</span>
              {mention.assigned && !mention.resolved && (
                <Badge
                  variant="outline"
                  className="border-red-500/30 bg-red-500/15 text-[10px] text-red-700 dark:text-red-400"
                >
                  assigné
                </Badge>
              )}
              {mention.resolved && (
                <Badge variant="outline" className="text-[10px]">
                  résolu
                </Badge>
              )}
              {mention.isNew && <Badge className="text-[10px]">nouveau</Badge>}
            </div>
            <p className="mt-0.5 line-clamp-3 text-xs text-muted-foreground">{mention.text}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
