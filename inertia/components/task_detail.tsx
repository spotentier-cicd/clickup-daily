import { ArrowUpRight } from '@phosphor-icons/react'
import { formatDateTime, formatUsd } from '@/lib/format'
import type { CSSProperties } from 'react'
import type { DressedTask } from '@/lib/board'
import type { ReportColumn } from '@/lib/report'

/*
| LE DÉTAIL D'UNE TÂCHE.
|
| Tout ce que la liste ne peut pas montrer sans devenir illisible.
|
| Deux présentations, un seul contenu. Sur un onglet de tâches, le détail est
| un panneau collé à droite : on parcourt la liste sans perdre de vue ce qu'on
| lisait. Ailleurs — dans la synthèse du matin, où il n'y a pas de liste — le
| même contenu s'ouvre en superposition, parce qu'un ticket doit s'ouvrir DANS
| l'application, pas dans un onglet de navigateur.
|
| Rien n'y est modifiable — le tableau de bord est en lecture seule. Le seul
| geste qu'il propose est d'aller éditer dans ClickUp.
*/

interface TaskDetailProps {
  dressed: DressedTask
  column: ReportColumn | undefined
}

/** Le panneau collant, à droite d'une liste de tâches. */
export function TaskDetail(props: TaskDetailProps) {
  return (
    <aside
      className="sticky top-[76px] flex max-h-[calc(100vh-96px)] min-w-[300px] flex-[0_1_420px] flex-col gap-[14px] overflow-auto px-5 pt-[18px] pb-5"
      style={{
        borderRadius: 10,
        background: props.dressed.mine ? 'var(--mine)' : 'var(--color-surface)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <TaskDetailContent {...props} />
    </aside>
  )
}

/** Le contenu seul, sans habillage : c'est lui que les deux présentations partagent. */
export function TaskDetailContent({ dressed, column }: TaskDetailProps) {
  const { task } = dressed

  return (
    <>
      <div className="flex flex-wrap items-center gap-[5px]">
        <span
          className="num mr-[3px]"
          style={{ font: '500 12.5px/1 var(--mono)', color: 'var(--ref)' }}
        >
          {task.ref}
        </span>
        {dressed.labels.map((label) => (
          <span
            key={label.text}
            style={{
              font: '500 10.5px/1 var(--font-body)',
              padding: '3px 6px',
              borderRadius: 5,
              color: label.fg,
              background: label.bg,
            }}
          >
            {label.text}
          </span>
        ))}
      </div>

      <h2
        className="m-0"
        style={{
          font: '500 19px/1.3 var(--font-heading)',
          letterSpacing: '-0.01em',
          textWrap: 'pretty',
        }}
      >
        {task.name}
      </h2>

      <dl
        className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-[7px]"
        style={{ font: '400 13px/1.4 var(--font-body)' }}
      >
        <dt style={TERM}>Statut</dt>
        <dd className="m-0 flex items-center gap-[7px]">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ background: column?.color ?? 'var(--faint)' }}
          />
          {task.columnLabel}
        </dd>

        <dt style={TERM}>Assignés</dt>
        <dd className="m-0">{dressed.assignees}</dd>

        <dt style={TERM}>Liste</dt>
        <dd className="m-0">
          {task.envLabel} · {task.listName}
        </dd>

        {dressed.due && (
          <>
            <dt style={TERM}>Échéance</dt>
            <dd
              className="m-0"
              style={{ color: dressed.due.late ? 'var(--red)' : 'var(--color-text)' }}
            >
              {dressed.due.text}
            </dd>
          </>
        )}

        {dressed.time && (
          <>
            <dt style={TERM}>Temps</dt>
            <dd
              className="m-0"
              style={{ color: dressed.time.over ? 'var(--red)' : 'var(--color-text)' }}
            >
              {dressed.time.text}
            </dd>
          </>
        )}

        {dressed.claudeUsd > 0 && (
          <>
            <dt style={TERM}>Claude</dt>
            <dd
              className="m-0"
              title="Équivalent au tarif de l’API — non facturé sur un abonnement"
            >
              {formatUsd(dressed.claudeUsd)} ce mois-ci
            </dd>
          </>
        )}

        <dt style={TERM}>Activité</dt>
        <dd className="m-0">{dressed.updated}</dd>
      </dl>

      {(dressed.fields.length > 0 || task.tags.length > 0) && (
        <div className="flex flex-wrap gap-1">
          {dressed.fields.map((field) => (
            <span
              key={field.name}
              style={{
                font: '400 11.5px/1 var(--font-body)',
                padding: '4px 7px',
                borderRadius: 5,
                background: 'var(--soft)',
              }}
            >
              <span style={{ color: 'var(--muted)' }}>{field.name}</span> {field.value}
            </span>
          ))}
          {task.tags.map((tag) => (
            <span
              key={tag}
              style={{
                font: '400 11.5px/1 var(--font-body)',
                padding: '3px 7px',
                borderRadius: 999,
                boxShadow: 'inset 0 0 0 1px var(--color-divider)',
                color: 'var(--muted)',
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {dressed.branches.length > 0 && (
        <div className="flex flex-col gap-[5px]">
          <div style={SECTION}>Branches</div>
          {dressed.branches.map((branch) => (
            <div key={`${branch.repo}/${branch.name}`} className="flex flex-col gap-[1px]">
              <span
                className="break-all"
                style={{
                  font: '400 12px/1.4 var(--mono)',
                  color: branch.warn ? 'var(--amber)' : 'var(--color-text)',
                }}
              >
                <span style={{ color: 'var(--muted)' }}>{branch.repo} ·</span> {branch.name}
              </span>
              <span
                style={{
                  font: '400 11.5px var(--font-body)',
                  color: branch.warn ? 'var(--amber)' : 'var(--faint)',
                }}
              >
                {branch.note}
              </span>
            </div>
          ))}
        </div>
      )}

      {task.description && (
        <div className="flex flex-col gap-[5px]">
          <div style={SECTION}>Description</div>
          <p
            className="m-0"
            style={{
              font: '400 13px/1.55 var(--font-body)',
              textWrap: 'pretty',
              color: 'color-mix(in srgb, var(--color-text) 88%, transparent)',
            }}
          >
            {task.description}
          </p>
        </div>
      )}

      {dressed.comments.length > 0 && (
        <div className="flex flex-col gap-[6px]">
          <div style={SECTION}>Derniers commentaires</div>
          {dressed.comments.map((comment) => (
            <div
              key={`${comment.author}-${comment.at}`}
              className="px-[10px] py-2"
              style={{
                borderRadius: 6,
                background: 'var(--soft)',
                font: '400 12.5px/1.45 var(--font-body)',
              }}
            >
              <div
                className="mb-[2px] flex gap-[6px]"
                style={{ fontSize: 11.5, color: 'var(--muted)' }}
              >
                <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>
                  {comment.author}
                </span>
                {formatDateTime(comment.at)}
              </div>
              {comment.text}
            </div>
          ))}
        </div>
      )}

      <a href={task.url} target="_blank" rel="noreferrer" className="btn btn-primary self-start">
        Ouvrir dans ClickUp
        <ArrowUpRight size={14} />
      </a>
    </>
  )
}

const TERM: CSSProperties = { color: 'var(--muted)' }

const SECTION: CSSProperties = {
  font: '500 11px var(--font-body)',
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  color: 'var(--faint)',
}
