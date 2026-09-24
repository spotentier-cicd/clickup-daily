import { Bell, Clock, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from 'cn'
import {
  formatDateTime,
  formatDuration,
  formatHours,
  formatSignedHours,
  formatWeekday,
  pluralize,
} from '@/lib/format'
import type { ReactNode } from 'react'
import type { Mention, Pointage, Report } from '@/lib/report'

/*
| LES INSTRUMENTS.
|
| Trois chiffres dans la barre, trois panneaux au clic. Ils occupaient un tiers
| de la page alors qu'on les consulte une fois par matin ; le chiffre suffit à
| savoir s'il faut regarder.
*/

function Instrument({
  icon,
  value,
  label,
  tone,
  children,
}: {
  icon: ReactNode
  value: string
  label: string
  tone?: 'urgent' | 'attention' | 'ok'
  children: ReactNode
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2" title={label}>
          {icon}
          <span
            className={cn(
              'text-label tabular-nums',
              tone === 'urgent' && 'text-urgent',
              tone === 'attention' && 'text-attention',
              tone === 'ok' && 'text-ok'
            )}
          >
            {value}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        {children}
      </PopoverContent>
    </Popover>
  )
}

function Entete({ children }: { children: ReactNode }) {
  return (
    <h3 className="flex h-9 items-center border-b border-rule px-3 text-label font-semibold tracking-[0.08em] text-muted-foreground uppercase">
      {children}
    </h3>
  )
}

/** Le pointage de la semaine. Aujourd'hui n'est jamais montré comme incomplet. */
export function PointageInstrument({ pointage }: { pointage: Pointage | null }) {
  if (!pointage) return null

  return (
    <Instrument
      icon={<Clock className="size-3.5 text-muted-foreground" />}
      value={formatHours(pointage.weekMs)}
      label="Pointage de la semaine"
      tone={pointage.gapMs > 0 ? 'attention' : 'ok'}
    >
      <Entete>Pointage</Entete>
      <div className="space-y-1.5 p-3 tabular-nums">
        {pointage.days.map((day) => {
          const ratio = day.targetMs ? Math.min(1, day.ms / day.targetMs) : 0

          return (
            <div key={day.date} className="flex items-center gap-2.5 text-label">
              <span className={cn('w-8 shrink-0 capitalize', day.isToday && 'font-medium')}>
                {formatWeekday(day.date)}
              </span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className={cn(
                    'block h-full rounded-full',
                    day.isToday
                      ? 'bg-muted-foreground'
                      : day.missingMs > 0
                        ? 'bg-attention'
                        : 'bg-ok'
                  )}
                  style={{ width: `${ratio * 100}%` }}
                />
              </span>
              <span className="w-20 shrink-0 text-right">
                {day.ms > 0 ? formatDuration(day.ms) : '—'}
                {day.missingMs > 0 && (
                  <span className="text-attention"> {formatSignedHours(-day.missingMs)}</span>
                )}
              </span>
            </div>
          )
        })}

        <dl className="mt-3 space-y-1 border-t border-rule pt-2.5 text-label">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Cette semaine</dt>
            <dd>
              {formatHours(pointage.weekMs)} / {formatHours(pointage.weekTargetMs)}
              {pointage.gapMs > 0 && (
                <span className="text-attention"> ({formatSignedHours(-pointage.gapMs)})</span>
              )}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Semaine passée</dt>
            <dd>
              {formatHours(pointage.prevMs)} / {formatHours(pointage.prevTargetMs)}
            </dd>
          </div>
          {pointage.running && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Minuteur en cours</dt>
              <dd className="font-medium text-attention">{pointage.running}</dd>
            </div>
          )}
        </dl>

        <p className="pt-1 text-label text-muted-foreground">
          La semaine entière, tous projets : le pointage ne suit pas le périmètre.
        </p>
      </div>
    </Instrument>
  )
}

/** Ce qui a bougé depuis le run de référence. */
export function ChangesInstrument({ diff }: { diff: Report['diff'] }) {
  const total =
    diff.entered.length + diff.statusChanged.length + diff.left.length + diff.assignedToMe.length

  return (
    <Instrument
      icon={<Bell className="size-3.5 text-muted-foreground" />}
      value={String(total)}
      label="Changements depuis le rapport précédent"
    >
      <Entete>Changements</Entete>
      <ScrollArea className="max-h-80">
        <div className="space-y-3 p-3 text-label">
          {!diff.since && (
            <p className="text-muted-foreground">Premier rapport : rien à comparer.</p>
          )}
          {diff.since && total === 0 && (
            <p className="text-muted-foreground">
              Rien n’a bougé depuis le {formatDateTime(diff.since)}.
            </p>
          )}

          <Groupe titre="M’ont été assignées" lignes={diff.assignedToMe.map(libelle)} />
          <Groupe titre="Entrées" lignes={diff.entered.map(libelle)} />
          <Groupe
            titre="Changements de statut"
            lignes={diff.statusChanged.map(
              (c) => `${c.task.ref} · ${c.previousStatus} → ${c.task.status}`
            )}
          />
          <Groupe
            titre="Sorties"
            lignes={diff.left.map((l) => `${l.snapshot.ref} → ${l.newStatus}`)}
          />
        </div>
      </ScrollArea>
    </Instrument>
  )
}

/** Les commentaires qui me citent ou qui m'ont été assignés. */
export function MentionsInstrument({
  mentions,
  lookbackDays,
}: {
  mentions: Mention[]
  lookbackDays: number
}) {
  const aTraiter = mentions.filter((m) => m.mention.assigned && !m.mention.resolved).length

  return (
    <Instrument
      icon={<MessageSquare className="size-3.5 text-muted-foreground" />}
      value={String(mentions.length)}
      label="Commentaires qui me concernent"
      tone={aTraiter > 0 ? 'urgent' : undefined}
    >
      <Entete>On me parle</Entete>
      <ScrollArea className="max-h-80">
        <div className="space-y-3 p-3 text-label">
          {mentions.length === 0 && (
            <p className="text-muted-foreground">
              Personne ne m’a cité sur les {lookbackDays} derniers jours.
            </p>
          )}

          {mentions.map(({ mention, task }, index) => (
            <div key={index}>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <a
                  href={task.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono font-semibold text-muted-foreground hover:text-foreground"
                >
                  {task.ref}
                </a>
                <span className="font-medium">{mention.author}</span>
                <span className="text-muted-foreground">{formatDateTime(mention.when)}</span>
                {mention.assigned && !mention.resolved && (
                  <span className="text-urgent">assigné</span>
                )}
                {mention.resolved && <span className="text-muted-foreground">résolu</span>}
                {mention.isNew && <span className="text-ok">nouveau</span>}
              </div>
              <p className="mt-0.5 line-clamp-3 text-muted-foreground">{mention.text}</p>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Instrument>
  )
}

function libelle(task: { ref: string; name: string }): string {
  return `${task.ref} · ${task.name}`
}

function Groupe({ titre, lignes }: { titre: string; lignes: string[] }) {
  if (lignes.length === 0) return null

  return (
    <div>
      <h4 className="font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {titre} <span className="tabular-nums">({lignes.length})</span>
      </h4>
      <ul className="mt-1 space-y-0.5">
        {lignes.map((ligne, index) => (
          <li key={index} className="truncate">
            {ligne}
          </li>
        ))}
      </ul>
    </div>
  )
}

export { pluralize }
