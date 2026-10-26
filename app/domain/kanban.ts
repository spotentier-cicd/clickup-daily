/*
| LE TABLEAU PERSONNEL.
|
| Les états d'une journée de dev — à faire, en cours, bloqué, à déployer, à
| tester — et ce qu'on a besoin d'avoir sous les yeux pour reprendre une
| tâche : le ticket, la branche front, la branche back, et la phrase qu'on se
| laisse à soi-même.
|
| Rien ici ne vient de ClickUp. Une carte PEUT citer un ticket, et le tableau
| sait alors ouvrir sa fiche, mais elle ne lui appartient pas : le ticket passe
| en recette, sort du périmètre ou s'archive, la carte reste telle qu'on l'a
| écrite. C'est la différence avec le reste du tableau de bord, qui n'est qu'un
| reflet.
|
| Module pur : il est partagé avec le navigateur, qui déplace les cartes à
| l'écran avec exactement la fonction que le serveur utilise pour les
| enregistrer.
*/

export const KANBAN_COLUMNS = [
  { key: 'todo', label: 'À faire', color: 'var(--env-1)' },
  { key: 'doing', label: 'En cours', color: 'var(--amber)' },
  { key: 'blocked', label: 'Bloqué', color: 'var(--red)' },
  { key: 'to_deploy', label: 'À déployer', color: 'var(--green)' },
  { key: 'to_test', label: 'À tester', color: 'var(--env-2)' },
] as const

export type KanbanColumn = (typeof KANBAN_COLUMNS)[number]
export type KanbanColumnKey = KanbanColumn['key']

/** Là où tombe une carte quand on n'a rien dit d'autre. */
export const FIRST_KANBAN_COLUMN: KanbanColumnKey = 'todo'

export function isKanbanColumn(value: unknown): value is KanbanColumnKey {
  return KANBAN_COLUMNS.some((column) => column.key === value)
}

/** Une colonne inconnue — un enregistrement ancien, une requête bricolée — retombe en « à faire ». */
export function toKanbanColumn(value: unknown): KanbanColumnKey {
  return isKanbanColumn(value) ? value : FIRST_KANBAN_COLUMN
}

export function kanbanColumn(key: KanbanColumnKey): KanbanColumn {
  return KANBAN_COLUMNS.find((column) => column.key === key) ?? KANBAN_COLUMNS[0]
}

/*
| Les dates restent en ISO, ici et côté navigateur.
|
| Contrairement au rapport, une carte ne traverse aucune règle de calcul : on
| n'en affiche que l'âge. La généricité sur la représentation des dates
| coûterait donc un type pour rien.
*/
export type KanbanCard = {
  id: number
  column: KanbanColumnKey
  position: number
  /** La référence du ticket (ROC-1801) ; vide pour une carte libre. */
  ref: string
  /** L'identifiant ClickUp, quand la carte a été posée depuis un ticket collecté. */
  taskId: string
  title: string
  url: string
  branchFront: string
  branchBack: string
  comment: string
  createdAt: string | null
  updatedAt: string | null
}

/** Ce qu'un formulaire peut écrire : ni l'identifiant, ni le rang, ni les dates. */
export type KanbanCardInput = {
  column: KanbanColumnKey
  ref: string
  taskId: string
  title: string
  url: string
  branchFront: string
  branchBack: string
  comment: string
}

/*
| Des plafonds larges, mais des plafonds.
|
| Une carte est une note, pas un document : un commentaire de dix mille signes
| est un collage accidentel, et il casserait la mise en page de la colonne bien
| avant d'inquiéter SQLite.
*/
export const KANBAN_LIMITS = {
  ref: 40,
  title: 200,
  url: 500,
  branch: 200,
  comment: 2000,
} as const

function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

/**
 * Ce qui entre en base, quoi qu'on ait envoyé.
 *
 * La même fonction sert à la création et à la modification : il n'y a qu'une
 * définition de ce qu'est une carte valable.
 */
export function sanitizeCardInput(raw: unknown): KanbanCardInput {
  const input = (raw ?? {}) as Partial<Record<keyof KanbanCardInput, unknown>>
  const url = clean(input.url, KANBAN_LIMITS.url)

  return {
    column: toKanbanColumn(input.column),
    ref: clean(input.ref, KANBAN_LIMITS.ref),
    taskId: clean(input.taskId, KANBAN_LIMITS.ref),
    title: clean(input.title, KANBAN_LIMITS.title),
    /* Seul un lien http tient lieu de lien : le reste ne s'ouvrirait nulle part. */
    url: /^https?:\/\//i.test(url) ? url : '',
    branchFront: clean(input.branchFront, KANBAN_LIMITS.branch),
    branchBack: clean(input.branchBack, KANBAN_LIMITS.branch),
    comment: clean(input.comment, KANBAN_LIMITS.comment),
  }
}

/**
 * Une carte qui ne dirait rien.
 *
 * Le ticket OU l'intitulé suffit — on note parfois « relancer l'infra » sans
 * qu'aucun ticket n'existe encore — mais une carte sans l'un ni l'autre serait
 * un rectangle muet qu'on ne saurait ni lire ni retrouver.
 */
export function isCardEmpty(input: KanbanCardInput): boolean {
  return !input.ref && !input.title
}

/**
 * Le nom de la branche d'un ticket.
 *
 * Il ne se choisit pas : « feature/ » suivi de la référence, toujours. C'est
 * ce qui permet à la carte de ne pas faire écrire ses branches mais seulement
 * cocher lesquelles existent — on ne se trompe pas sur un nom qu'on ne tape
 * pas, et la carte cite alors exactement ce que la collecte trouvera en local.
 *
 * La casse reste celle de la référence saisie : c'est le custom_id ClickUp qui
 * fait foi, et c'est lui qu'on recopie en nommant la branche.
 */
export function branchFor(ref: string): string {
  const trimmed = ref.trim()
  return trimmed ? `feature/${trimmed}` : ''
}

/** Ce qu'on lit en tête de carte. */
export function cardLabel(card: Pick<KanbanCard, 'ref' | 'title'>): string {
  return card.title || card.ref
}

type Placed = { id: number; column: KanbanColumnKey; position: number }

const COLUMN_ORDER = new Map(KANBAN_COLUMNS.map((column, index) => [column.key, index]))

/** L'ordre d'affichage : les colonnes du workflow, puis le rang, puis l'ancienneté. */
export function sortCards<T extends Placed>(cards: T[]): T[] {
  return [...cards].sort((a, b) => {
    const column = (card: Placed) => COLUMN_ORDER.get(card.column) ?? COLUMN_ORDER.size
    if (column(a) !== column(b)) return column(a) - column(b)
    if (a.position !== b.position) return a.position - b.position
    return a.id - b.id
  })
}

/** Les cartes d'une colonne, dans l'ordre. */
export function cardsOfColumn<T extends Placed>(cards: T[], column: KanbanColumnKey): T[] {
  return sortCards(cards).filter((card) => card.column === column)
}

/**
 * Déplace une carte et renumérote tout.
 *
 * Les positions redeviennent 0, 1, 2… dans chaque colonne, plutôt que de
 * s'intercaler en décimales : une carte glissée entre deux autres finirait par
 * demander une précision dont une colonne qu'on relit d'un bloc n'a jamais
 * besoin. Et la colonne d'origine se renumérote aussi — la carte partie y
 * laissait un trou.
 *
 * Le navigateur appelle cette fonction pour redessiner tout de suite, le
 * serveur l'appelle pour enregistrer. Les deux ne peuvent donc pas diverger.
 */
export function moveCard<T extends Placed>(
  cards: T[],
  id: number,
  column: KanbanColumnKey,
  index: number
): T[] {
  const moved = cards.find((card) => card.id === id)
  if (!moved) return sortCards(cards)

  const buckets = new Map<KanbanColumnKey, T[]>(KANBAN_COLUMNS.map((entry) => [entry.key, []]))
  for (const card of sortCards(cards)) {
    if (card.id === id) continue
    buckets.get(toKanbanColumn(card.column))!.push(card)
  }

  const target = buckets.get(column)!
  /* Un index hors bornes — une carte lâchée sous la pile — tombe à la fin. */
  target.splice(Math.max(0, Math.min(index, target.length)), 0, moved)

  return [...buckets.entries()].flatMap(([key, list]) =>
    list.map((card, rank) => ({ ...card, column: key, position: rank }))
  )
}

/** Le rang d'une carte nouvelle : au bas de sa colonne. */
export function nextPosition(cards: Placed[], column: KanbanColumnKey): number {
  return cardsOfColumn(cards, column).length
}
