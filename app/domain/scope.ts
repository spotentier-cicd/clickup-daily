import { normalize } from '#domain/text'
import type { ColumnMapping } from '#domain/task/types'

/*
| LE PÉRIMÈTRE.
|
| La v1 et le début de la v2 citaient trois espaces ClickUp en dur dans la
| configuration, avec leur identifiant et la liste exacte de leurs statuts.
| Désormais l'arborescence est DÉCOUVERTE — espaces, dossiers, listes, et les
| statuts propres à chaque liste — et c'est un réglage, pas un fichier source,
| qui dit ce qu'on regarde.
|
| L'ATOME EST LA LISTE, et ce choix n'est pas arbitraire : c'est le niveau où
| les statuts existent réellement dans ClickUp. Le dossier « ROC Sprints » et
| ses 28 listes partagent les mêmes statuts, mais « ROC QA » a les siens
| (documentation, en cours…) : ranger le réglage au-dessus de la liste
| obligerait à inventer une union qui ne correspondrait à aucun écran ClickUp.
| Espace et dossier ne sont donc que des raccourcis de cochage dans la page.
|
| UNE SEULE COCHE, DEUX EFFETS. Une liste suivie est interrogée à la collecte
| ET affichée dans le tableau ; la décocher l'en sort aussitôt, y compris d'un
| rapport déjà en base — sans rien effacer, la recocher la ramène sans un seul
| appel.
|
| LISTE BLANCHE, TOUJOURS. Ce qui n'a pas été coché n'entre pas : un sprint
| créé le mois prochain, un dossier ajouté, un statut nouveau n'apparaissent
| jamais tout seuls. Ils se signalent dans la page de paramétrage.
*/

/** Un espace ClickUp, tel que l'API le rend. */
export type SpaceInfo = {
  id: string
  name: string
  private: boolean
}

/** Une liste, avec les statuts qu'elle propose réellement. */
export type ListInfo = {
  id: string
  name: string
  /** Statuts dans l'orthographe exacte de ClickUp — c'est ce qu'attend le filtre. */
  statuses: string[]
}

export type FolderInfo = {
  id: string
  name: string
  lists: ListInfo[]
}

/** L'arborescence d'un espace. `lists` porte celles qui n'ont pas de dossier. */
export type SpaceTree = {
  space: SpaceInfo
  folders: FolderInfo[]
  lists: ListInfo[]
}

/** Ce qu'on garde d'une liste suivie. */
export type FollowedList = {
  /** Identifiant de l'espace : il évite de reparcourir l'arborescence pour le retrouver. */
  space: string
  /** Statuts affichés, dans l'orthographe de ClickUp. Vide = la liste ne montre rien. */
  statuses: string[]
  /**
   * Statuts que la liste proposait au moment du choix.
   *
   * C'est ce qui distingue « je n'en veux pas » de « il n'existait pas
   * encore » : sans cette trace, une liste réglée sur les six statuts du
   * workflow signalerait les douze autres comme des nouveautés, à chaque
   * ouverture de la page.
   *
   * Vide veut dire « on ne sait pas » — un enregistrement antérieur à ce
   * champ. On ne signale alors rien : mieux vaut se taire que crier au loup.
   */
  seen: string[]
}

export type ScopePreferences = {
  /**
   * L'équipe ClickUp interrogée.
   *
   * Nul tant qu'on n'a pas choisi : le jeton en donne souvent une seule, et on
   * la prend alors sans rien demander. Ce champ ne sert qu'aux comptes qui en
   * ont plusieurs.
   */
  team: string | null
  lists: Record<string, FollowedList>
  /**
   * Rattachement statut → colonne, tel qu'on l'a choisi.
   *
   * Absent d'un statut = on n'a rien dit, et la proposition automatique
   * s'applique. Chaîne vide = « aucune étape », donc « Autres ».
   */
  columns: ColumnMapping
}

export function defaultScope(): ScopePreferences {
  return { team: null, lists: {}, columns: {} }
}

/** Les listes à interroger. Vide = aucune collecte. */
export function followedListIds(scope: ScopePreferences): string[] {
  return Object.keys(scope.lists)
}

/**
 * L'union des statuts suivis, pour le filtre de l'API.
 *
 * C'est volontairement plus large que le besoin : une tâche d'une liste A dans
 * un statut coché seulement pour B sera ramenée, puis écartée par
 * `isTaskInScope`. L'inverse — filtrer liste par liste — coûterait une requête
 * par liste.
 */
export function followedStatuses(scope: ScopePreferences): string[] {
  const statuses = new Set<string>()
  for (const list of Object.values(scope.lists)) {
    for (const status of list.statuses) statuses.add(status)
  }
  return [...statuses]
}

/** Les espaces représentés par au moins une liste suivie. */
export function followedSpaces(scope: ScopePreferences): string[] {
  return [...new Set(Object.values(scope.lists).map((list) => list.space))]
}

export function isListFollowed(listId: string, scope: ScopePreferences): boolean {
  return listId in scope.lists
}

/**
 * Une tâche entre si sa liste est suivie ET si son statut y est coché.
 *
 * Une tâche sans identifiant de liste vient d'une archive antérieure à ce
 * réglage : on ne la juge pas, sinon rouvrir un rapport de la semaine dernière
 * donnerait un écran vide.
 */
export function isTaskInScope(
  task: { listId: string; status: string },
  scope: ScopePreferences
): boolean {
  if (!task.listId) return true

  const list = scope.lists[task.listId]
  if (!list) return false

  const status = normalize(task.status)
  return list.statuses.some((allowed) => normalize(allowed) === status)
}

/**
 * Les statuts apparus dans une liste depuis le dernier choix.
 *
 * Ni cochés ni refusés : ils n'existaient pas quand on a réglé la liste. La
 * page les signale, elle ne les ajoute pas — la liste blanche reste la règle.
 */
export function newStatuses(list: ListInfo, scope: ScopePreferences): string[] {
  const followed = scope.lists[list.id]
  if (!followed || followed.seen.length === 0) return []

  const seen = new Set(followed.seen.map(normalize))
  return list.statuses.filter((status) => !seen.has(normalize(status)))
}

/**
 * L'équipe à interroger.
 *
 * Trois sources, dans cet ordre : le choix fait dans /parametres, la variable
 * d'environnement (pour un poste qui n'a pas d'interface), puis la seule
 * équipe du jeton. Un compte multi-équipes sans choix prend la première et la
 * page le signale — mieux vaut un tableau que rien.
 */
export function resolveTeam(
  teams: { id: string; name: string }[],
  scope: ScopePreferences,
  fromEnv?: string
): { id: string; name: string } | null {
  const pick = (id: string | null | undefined) =>
    id ? (teams.find((team) => team.id === id) ?? null) : null

  return pick(scope.team) ?? pick(fromEnv) ?? teams[0] ?? null
}
