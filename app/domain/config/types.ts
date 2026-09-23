/*
| Types de la configuration de l'application.
|
| Ce dossier fait partie du domaine : aucune I/O, aucun import d'AdonisJS.
| Les fonctions du domaine reçoivent les tranches de config dont elles ont
| besoin en paramètre, elles ne vont jamais les chercher elles-mêmes.
*/

/** Un espace ClickUp interrogé, avec les statuts exacts à en ramener. */
export interface EnvironmentConfig {
  key: string
  label: string
  spaceId: string
  /**
   * Noms de statuts tels qu'ils existent dans ClickUp. Attention : ils sont
   * sans accents dans ce workspace, et ROC dit « revue ok » là où Tempo dit
   * « revue de code ok ».
   */
  statuses: string[]
}

/** Une colonne du tableau, qui regroupe un ou plusieurs statuts. */
export interface ColumnConfig {
  key: string
  label: string
  match: string[]
  color: string
}

export type EnrichScope = 'mine' | 'revue_a_faire'

/** Récupération des commentaires, plafonnée pour tenir le quota d'appels. */
export interface EnrichConfig {
  comments: boolean
  commentsPerTask: number
  maxTasks: number
  scope: EnrichScope[]
}

/** Règles qui classent une tâche comme bug. Une seule suffit. */
export interface BugsConfig {
  taskTypes: string[]
  listNameContains: string[]
  tags: string[]
  namePrefixes: string[]
}

/** Tâches écartées du rapport parce qu'elles n'ont pas été priorisées. */
export interface BacklogConfig {
  statuses: string[]
  folderNameContains: string[]
  listNameContains: string[]
  /** Garder malgré tout celles qui me sont assignées. */
  keepMine: boolean
}

export interface BlockersConfig {
  /** Au-delà, une revue en souffrance remonte : là, je bloque quelqu'un. */
  reviewWaitDays: number
  /** Au-delà, une tâche qui dort sur recette remonte. */
  recetteWaitDays: number
  maxItems: number
}

export interface TempsConfig {
  enabled: boolean
  /** Profondeur d'historique lue en un seul appel. */
  lookbackDays: number
  targetHoursPerDay: number
  /** Jours attendus, 0 = lundi. */
  weekDays: number[]
}

export interface GitConfig {
  enabled: boolean
  /** Chemins locaux ; le ~ est développé, un dépôt absent est ignoré. */
  repos: string[]
  maxBranchesPerTask: number
}

export interface MentionsConfig {
  enabled: boolean
  lookbackDays: number
  /** Borne le balayage : c'est un appel par tâche, la partie la plus coûteuse. */
  scanMaxTasks: number
}

export interface ReportConfig {
  /** Rétention des runs en base. */
  keepDays: number
  descriptionExcerptChars: number
  notify: boolean
}

export interface VeilleGroup {
  key: string
  label: string
}

export interface VeilleSource {
  label: string
  /** Doit correspondre à une clé de veille.groups. */
  group: string
  url: string
}

export interface VeilleConfig {
  enabled: boolean
  maxAgeDays: number
  perSource: number
  maxItems: number
  timeoutSeconds: number
  /** Un flux n'est pas retéléchargé avant ce délai. */
  cacheHours: number
  /** Écarte les préversions. */
  excludeTitle: string[]
  /** Mots-clés de notre stack ; un * final autorise un suffixe. */
  highlight: string[]
  groups: VeilleGroup[]
  sources: VeilleSource[]
}

export interface ClickUpDailyConfig {
  workspaceId: string
  timezone: string
  /** Identifiant ClickUp ; normalement redéterminé via le token, sert de secours. */
  meUserId: number
  environments: EnvironmentConfig[]
  columns: ColumnConfig[]
  enrich: EnrichConfig
  bugs: BugsConfig
  backlog: BacklogConfig
  /** Seuil de la section « en cours mais sans activité ». */
  staleAfterDays: number
  blockers: BlockersConfig
  temps: TempsConfig
  git: GitConfig
  mentions: MentionsConfig
  ignoredCustomFieldsPrefix: string[]
  report: ReportConfig
  veille: VeilleConfig
}
