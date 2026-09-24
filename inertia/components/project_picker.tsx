import { Eye, EyeOff, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from 'cn'
import { pluralize } from '@/lib/format'
import type { FieldUsage, ProjectCatalog, ProjectControls } from '@/lib/projects'

interface ProjectPickerProps {
  catalog: ProjectCatalog
  fields: FieldUsage[]
  preferences: ProjectControls
  hiddenCount: number
}

/**
 * Le choix de ce qu'on regarde.
 *
 * Trois niveaux, du plus large au plus fin : les espaces ClickUp, les listes
 * qu'ils contiennent, et les champs affichés sur les cartes. Chaque ligne
 * porte son compteur — on masque en sachant ce qu'on perd.
 */
export function ProjectPicker({ catalog, fields, preferences, hiddenCount }: ProjectPickerProps) {
  const { isEnvironmentVisible, isListVisible, isFieldVisible } = preferences
  const nothingHidden =
    preferences.preferences.hiddenEnvironments.length === 0 &&
    preferences.preferences.hiddenLists.length === 0 &&
    preferences.preferences.hiddenFields.length === 0

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <SlidersHorizontal className="size-4" />
          Projets
          {hiddenCount > 0 && (
            <span className="rounded-full bg-amber-500/20 px-1.5 text-[10px] font-medium text-amber-700 tabular-nums dark:text-amber-400">
              −{hiddenCount}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Projets affichés</SheetTitle>
          <SheetDescription>
            Ce qui est masqué reste collecté et archivé — vous pouvez le réafficher sans relancer de
            collecte.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <ul className="space-y-4">
            {catalog.environments.map((environment) => {
              const visible = isEnvironmentVisible(environment.key)

              return (
                <li key={environment.key}>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`env-${environment.key}`}
                      checked={visible}
                      onCheckedChange={() => preferences.toggleEnvironment(environment.key)}
                    />
                    <label
                      htmlFor={`env-${environment.key}`}
                      className={cn(
                        'flex-1 cursor-pointer text-sm font-medium',
                        !visible && 'text-muted-foreground line-through decoration-1'
                      )}
                    >
                      {environment.label}
                    </label>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {environment.total}
                      {environment.mine > 0 && ` · ${environment.mine} à moi`}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-[11px]"
                      onClick={() => preferences.onlyEnvironment(catalog, environment.key)}
                      title="N’afficher que celui-ci"
                    >
                      seul
                    </Button>
                  </div>

                  {environment.lists.length > 0 && (
                    <ul className={cn('mt-1.5 ml-6 space-y-1', !visible && 'opacity-40')}>
                      {environment.lists.map((list) => {
                        const listVisible = isListVisible(environment.key, list.name)

                        return (
                          <li key={list.key} className="flex items-center gap-2">
                            <Checkbox
                              id={`list-${list.key}`}
                              checked={listVisible}
                              disabled={!visible}
                              onCheckedChange={() =>
                                preferences.toggleList(environment.key, list.name)
                              }
                            />
                            <label
                              htmlFor={`list-${list.key}`}
                              className={cn(
                                'flex-1 cursor-pointer truncate text-xs',
                                !listVisible && 'text-muted-foreground line-through decoration-1'
                              )}
                            >
                              {list.name}
                            </label>
                            <span className="text-[11px] text-muted-foreground tabular-nums">
                              {list.total}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>

          <Separator className="my-5" />

          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Champs sur les cartes
          </h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Un champ renseigné partout ne distingue aucune tâche : il alourdit chaque carte sans
            l’informer. Ceux-là sont signalés.
          </p>

          <ul className="mt-2 space-y-1">
            {fields.map((field) => {
              const visible = isFieldVisible(field.name)

              return (
                <li key={field.name} className="flex items-center gap-2">
                  <Checkbox
                    id={`field-${field.name}`}
                    checked={visible}
                    onCheckedChange={() => preferences.toggleField(field.name)}
                  />
                  <label
                    htmlFor={`field-${field.name}`}
                    className={cn(
                      'flex-1 cursor-pointer truncate text-xs',
                      !visible && 'text-muted-foreground line-through decoration-1'
                    )}
                  >
                    {field.name.trim()}
                  </label>
                  {field.noisy && (
                    <span className="rounded bg-amber-500/15 px-1 text-[10px] text-amber-700 dark:text-amber-400">
                      peu utile
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {field.count} · {pluralize(field.distinct, 'valeur')}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="flex items-center gap-2 border-t px-4 py-3">
          <span className="flex-1 text-xs text-muted-foreground">
            {hiddenCount > 0 ? (
              <>
                <EyeOff className="mr-1 inline size-3.5 align-text-bottom" />
                {pluralize(hiddenCount, 'tâche masquée', 'tâches masquées')}
              </>
            ) : (
              <>
                <Eye className="mr-1 inline size-3.5 align-text-bottom" />
                Tout est affiché
              </>
            )}
          </span>
          <Button variant="ghost" size="sm" disabled={nothingHidden} onClick={preferences.reset}>
            <RotateCcw className="size-3.5" />
            Réinitialiser
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
