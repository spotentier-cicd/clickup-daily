/*
| Types de la configuration de l'application.
|
| Ce dossier fait partie du domaine : aucune I/O, aucun import d'AdonisJS.
| Les fonctions du domaine reçoivent les tranches de config dont elles ont
| besoin en paramètre, elles ne vont jamais les chercher elles-mêmes.
*/

/**
 * Une colonne du tableau : une étape du workflow, pas un statut ClickUp.
 *
 * Les statuts, eux, varient d'un workspace à l'autre — « in progress » ici,
 * « dev en cours » là. Ils ne sont donc PAS écrits en configuration : la page
 * de paramétrage les découvre et les rattache à une colonne.
 *
 * `hints` ne sert qu'à proposer ce rattachement au premier passage : des
 * fragments de mots, français et anglais, qu'on cherche dans le nom du statut.
 * C'est ce qui fait qu'un workspace inconnu s'affiche correctement sans qu'on
 * ait rien réglé — la proposition reste modifiable, et le choix explicite
 * l'emporte toujours.
 */
export interface ColumnConfig {
  key: string
  label: string
  hints: string[]
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

export interface ClaudeConfig {
  /**
   * Racine des transcriptions Claude Code. Le ~ est développé ; en conteneur,
   * CLAUDE_TRANSCRIPTS_PATH prend le dessus.
   */
  transcriptsPath: string
  /** Les sous-agents ont leurs propres fichiers : sans eux, le total est faux. */
  includeSubagents: boolean
  /** Chercher aussi les tickets cités dans le texte des messages, pas que dans la branche. */
  scanMessageText: boolean
}

export interface ClickUpDailyConfig {
  timezone: string
  columns: ColumnConfig[]
  enrich: EnrichConfig
  bugs: BugsConfig
  /** Seuil de la section « en cours mais sans activité ». */
  staleAfterDays: number
  blockers: BlockersConfig
  temps: TempsConfig
  git: GitConfig
  mentions: MentionsConfig
  ignoredCustomFieldsPrefix: string[]
  report: ReportConfig
  veille: VeilleConfig
  claude: ClaudeConfig
}
