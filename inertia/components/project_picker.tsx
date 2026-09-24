import { Layers, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { cn } from 'cn'
import { pluralize } from '@/lib/format'
import type { FieldUsage, ProjectCatalog, ProjectControls } from '@/lib/projects'

interface ProjectPickerProps {
  catalog: ProjectCatalog
  fields: FieldUsage[]
  preferences: ProjectControls
  hiddenCount: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Le périmètre : ce qu'on regarde ce matin.
 *
 * En popover et non en panneau latéral, et `modal={false}` : la page se
 * redessine derrière pendant qu'on coche, donc on voit ce qu'on est en train de
 * régler. Un panneau qui recouvre la moitié de l'écran ne le permet pas.
 *
 * On stocke ce qui est MASQUÉ, jamais ce qui est visible : une liste créée
 * demain dans ClickUp apparaît d'elle-même, au lieu de rester invisible pour
 * toujours et en silence.
 */
export function ProjectPicker({
  catalog,
  fields,
  preferences,
  hiddenCount,
  open,
  onOpenChange,
}: ProjectPickerProps) {
  const { isEnvironmentVisible, isListVisible, isFieldVisible } = preferences

  const listes = catalog.environments.flatMap((environment) => environment.lists)
  const visibles = listes.filter(
    (list) => isEnvironmentVisible(list.envKey) && isListVisible(list.envKey, list.name)
  ).length
  const partiel = visibles < listes.length
  const bruyants = fields.filter((field) => field.noisy && isFieldVisible(field.name))

  return (
    <Popover open={open} onOpenChange={onOpenChange} modal={false}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('h-7 gap-1.5', partiel && 'border-urgent/40 text-foreground')}
        >
          <Layers className="size-3.5" />
          Périmètre
          <span className="text-muted-foreground tabular-nums">
            {visibles}/{listes.length}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="flex h-9 items-center gap-2 border-b border-rule px-3 text-label">
          <span className="font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Projets affichés
          </span>
          <button
            type="button"
            className="ml-auto text-muted-foreground hover:text-foreground"
            onClick={preferences.reset}
          >
            Tout
          </button>
        </div>

        <div className="max-h-[26rem] overflow-y-auto px-3 py-2">
          {catalog.environments.map((environment) => {
            const visible = isEnvironmentVisible(environment.key)
            const masquees = environment.lists.filter(
              (list) => !isListVisible(environment.key, list.name)
            ).length
            const partielEnv = visible && masquees > 0 && masquees < environment.lists.length

            return (
              <div key={environment.key} className="mb-2">
                <div className="group/env flex h-7 items-center gap-2">
                  <Checkbox
                    id={`env-${environment.key}`}
                    checked={partielEnv ? 'indeterminate' : visible}
                    onCheckedChange={() => preferences.toggleEnvironment(environment.key)}
                  />
                  <label
                    htmlFor={`env-${environment.key}`}
                    className={cn(
                      'flex-1 cursor-pointer truncate text-body font-medium',
                      !visible && 'text-muted-foreground line-through decoration-1'
                    )}
                  >
                    {environment.label}
                  </label>
                  <span className="text-label text-muted-foreground tabular-nums">
                    {environment.total}
                    {environment.mine > 0 && ` · ${environment.mine} à moi`}
                  </span>
                  <button
                    type="button"
                    className="text-label text-muted-foreground opacity-0 group-hover/env:opacity-100 hover:text-foreground"
                    onClick={() => preferences.onlyEnvironment(catalog, environment.key)}
                  >
                    seul
                  </button>
                </div>

                <div className={cn('ml-6', !visible && 'opacity-40')}>
                  {environment.lists.map((list) => {
                    const listeVisible = isListVisible(environment.key, list.name)

                    return (
                      <div key={list.key} className="group/list flex h-7 items-center gap-2">
                        <Checkbox
                          id={`list-${list.key}`}
                          checked={listeVisible}
                          disabled={!visible}
                          onCheckedChange={() => preferences.toggleList(environment.key, list.name)}
                        />
                        <label
                          htmlFor={`list-${list.key}`}
                          className={cn(
                            'flex-1 cursor-pointer truncate text-body',
                            !listeVisible && 'text-muted-foreground line-through decoration-1'
                          )}
                        >
                          {list.name}
                        </label>
                        <span className="text-label text-muted-foreground tabular-nums">
                          {list.total}
                        </span>
                        <button
                          type="button"
                          className="text-label text-muted-foreground opacity-0 group-hover/list:opacity-100 hover:text-foreground"
                          onClick={() => preferences.onlyList(catalog, environment.key, list.name)}
                        >
                          seule
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          <Separator className="my-3" />

          <div className="flex items-center gap-2">
            <span className="text-label font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              Champs sur les lignes
            </span>
            {bruyants.length > 0 && (
              <button
                type="button"
                className="ml-auto text-label text-muted-foreground hover:text-foreground"
                onClick={() => preferences.hideNoisyFields(fields)}
              >
                Masquer les peu utiles ({bruyants.length})
              </button>
            )}
          </div>
          <p className="mt-1 text-label text-muted-foreground">
            Les deux champs les plus discriminants d’une tâche s’affichent sur sa ligne — un champ
            renseigné partout tombe de lui-même en dernier.
          </p>

          <div className="mt-1.5">
            {fields.map((field) => {
              const visible = isFieldVisible(field.name)

              return (
                <div key={field.name} className="flex h-7 items-center gap-2">
                  <Checkbox
                    id={`field-${field.name}`}
                    checked={visible}
                    onCheckedChange={() => preferences.toggleField(field.name)}
                  />
                  <label
                    htmlFor={`field-${field.name}`}
                    className={cn(
                      'flex-1 cursor-pointer truncate text-body',
                      !visible && 'text-muted-foreground line-through decoration-1'
                    )}
                  >
                    {field.name.trim()}
                  </label>
                  {field.noisy && <span className="text-label text-attention">peu utile</span>}
                  <span className="text-label text-muted-foreground tabular-nums">
                    {field.count} · {pluralize(field.distinct, 'valeur')}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-rule px-3 py-2 text-label">
          <span className="flex-1 text-muted-foreground tabular-nums">
            {hiddenCount > 0
              ? `${pluralize(hiddenCount, 'tâche masquée', 'tâches masquées')}`
              : 'Tout est affiché'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-label"
            onClick={preferences.reset}
          >
            <RotateCcw className="size-3" />
            Réinitialiser
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
