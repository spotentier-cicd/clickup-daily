/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  dashboard: typeof routes['dashboard'] & {
    archive: typeof routes['dashboard.archive']
  }
  refresh: typeof routes['refresh']
  preferences: {
    projects: typeof routes['preferences.projects']
    scope: typeof routes['preferences.scope']
  }
  kanban: {
    store: typeof routes['kanban.store']
    update: typeof routes['kanban.update']
    move: typeof routes['kanban.move']
    destroy: typeof routes['kanban.destroy']
  }
  settings: typeof routes['settings']
}
