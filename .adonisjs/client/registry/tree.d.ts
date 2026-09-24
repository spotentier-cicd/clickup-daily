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
  settings: typeof routes['settings']
}
