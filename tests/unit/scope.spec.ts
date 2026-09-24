import { test } from '@japa/runner'
import {
  defaultScope,
  resolveTeam,
  followedListIds,
  followedSpaces,
  followedStatuses,
  isListFollowed,
  isTaskInScope,
  newStatuses,
} from '#domain/scope'
import type { ListInfo, ScopePreferences } from '#domain/scope'

const EVOL = 'L-evol'
const SPRINT = 'L-sprint'
const SUPPORT = 'L-support'
const ROC = 'S-roc'
const TEMPO = 'S-tempo'

const listEvol: ListInfo = {
  id: EVOL,
  name: 'ROC Evol',
  statuses: ['nouveau', 'a faire', 'dev en cours', 'pause', 'deployé sur recette'],
}

/** `seen` retombe sur les statuts choisis : rien ne se signale comme nouveau. */
function scope(
  lists: Record<string, { space: string; statuses: string[]; seen?: string[] }>
): ScopePreferences {
  return {
    team: null,
    columns: {},
    lists: Object.fromEntries(
      Object.entries(lists).map(([id, list]) => [id, { ...list, seen: list.seen ?? list.statuses }])
    ),
  }
}

test.group('Périmètre — ce qu’on interroge', () => {
  test('rien n’est suivi tant que rien n’est coché', ({ assert }) => {
    const vide = defaultScope()

    assert.isEmpty(followedListIds(vide))
    assert.isEmpty(followedStatuses(vide))
    assert.isEmpty(followedSpaces(vide))
    assert.isFalse(isListFollowed(EVOL, vide))
  })

  test('les listes cochées partent dans le filtre', ({ assert }) => {
    const current = scope({
      [EVOL]: { space: ROC, statuses: ['nouveau', 'dev en cours'] },
      [SPRINT]: { space: ROC, statuses: ['dev en cours'] },
    })

    assert.deepEqual(followedListIds(current).sort(), [EVOL, SPRINT].sort())
    assert.isTrue(isListFollowed(SPRINT, current))
  })

  test('l’union des statuts dédoublonne entre listes', ({ assert }) => {
    const current = scope({
      [EVOL]: { space: ROC, statuses: ['nouveau', 'dev en cours'] },
      [SPRINT]: { space: ROC, statuses: ['dev en cours', 'revue ok'] },
    })

    assert.deepEqual(followedStatuses(current).sort(), ['dev en cours', 'nouveau', 'revue ok'])
  })

  test('les espaces se déduisent des listes suivies', ({ assert }) => {
    const current = scope({
      [EVOL]: { space: ROC, statuses: ['nouveau'] },
      [SPRINT]: { space: ROC, statuses: ['nouveau'] },
      [SUPPORT]: { space: TEMPO, statuses: ['en cours'] },
    })

    assert.deepEqual(followedSpaces(current).sort(), [ROC, TEMPO].sort())
  })
})

test.group('Périmètre — ce qu’on affiche', () => {
  const current = scope({
    [EVOL]: { space: ROC, statuses: ['nouveau', 'dev en cours'] },
    [SPRINT]: { space: ROC, statuses: ['dev en cours'] },
  })

  test('une liste non suivie ne passe pas', ({ assert }) => {
    assert.isFalse(isTaskInScope({ listId: SUPPORT, status: 'dev en cours' }, current))
  })

  test('un statut non coché pour SA liste ne passe pas', ({ assert }) => {
    assert.isTrue(isTaskInScope({ listId: EVOL, status: 'nouveau' }, current))
    assert.isFalse(
      isTaskInScope({ listId: SPRINT, status: 'nouveau' }, current),
      'nouveau n’est coché que sur ROC Evol'
    )
  })

  test('la comparaison des statuts ignore accents et casse', ({ assert }) => {
    assert.isTrue(isTaskInScope({ listId: EVOL, status: 'DEV EN COURS' }, current))
    assert.isTrue(
      isTaskInScope(
        { listId: EVOL, status: 'déployé sur recette' },
        scope({
          [EVOL]: { space: ROC, statuses: ['deploye sur recette'] },
        })
      )
    )
  })

  test('une liste suivie sans aucun statut n’affiche rien', ({ assert }) => {
    const muette = scope({ [EVOL]: { space: ROC, statuses: [] } })

    assert.isFalse(isTaskInScope({ listId: EVOL, status: 'nouveau' }, muette))
  })

  test('une archive sans identifiant de liste reste lisible', ({ assert }) => {
    assert.isTrue(
      isTaskInScope({ listId: '', status: 'production' }, current),
      'on ne juge pas ce qu’on ne sait pas situer'
    )
  })
})

test.group('Périmètre — ce qui est apparu depuis', () => {
  test('un statut ajouté à une liste suivie se signale', ({ assert }) => {
    /* Réglée quand la liste n'offrait que ces trois statuts. */
    const current = scope({
      [EVOL]: { space: ROC, statuses: ['nouveau'], seen: ['nouveau', 'a faire', 'dev en cours'] },
    })

    assert.deepEqual(newStatuses(listEvol, current), ['pause', 'deployé sur recette'])
  })

  test('un statut refusé ne se signale pas comme nouveau', ({ assert }) => {
    /* « a faire » existait au moment du choix : ne pas l'avoir coché est une décision. */
    const current = scope({
      [EVOL]: { space: ROC, statuses: ['nouveau'], seen: listEvol.statuses },
    })

    assert.isEmpty(newStatuses(listEvol, current))
  })

  test('une liste non suivie n’a rien à signaler', ({ assert }) => {
    assert.isEmpty(newStatuses(listEvol, defaultScope()))
  })

  test('une liste entièrement cochée n’a rien à signaler', ({ assert }) => {
    const current = scope({ [EVOL]: { space: ROC, statuses: listEvol.statuses } })

    assert.isEmpty(newStatuses(listEvol, current))
  })

  test('une liste réglée avant que « seen » existe ne crie pas au loup', ({ assert }) => {
    /* Enregistrement ancien : on ne sait pas ce que la liste proposait alors. */
    const current = scope({ [EVOL]: { space: ROC, statuses: ['nouveau'], seen: [] } })

    assert.isEmpty(newStatuses(listEvol, current))
  })
})

test.group('Périmètre — l’équipe vient du jeton', () => {
  const teams = [
    { id: 'T1', name: 'Acme' },
    { id: 'T2', name: 'Autre client' },
  ]

  test('une seule équipe se prend sans rien demander', ({ assert }) => {
    assert.deepEqual(resolveTeam([teams[0]], defaultScope()), teams[0])
  })

  test('le choix enregistré l’emporte', ({ assert }) => {
    const chosen = { ...defaultScope(), team: 'T2' }
    assert.deepEqual(resolveTeam(teams, chosen), teams[1])
  })

  test('la variable d’environnement sert quand rien n’est choisi', ({ assert }) => {
    assert.deepEqual(resolveTeam(teams, defaultScope(), 'T2'), teams[1])
  })

  test('un choix qui ne correspond à rien retombe sur la première', ({ assert }) => {
    const perime = { ...defaultScope(), team: 'T9' }
    assert.deepEqual(resolveTeam(teams, perime), teams[0])
  })

  test('sans équipe du tout, on ne devine pas', ({ assert }) => {
    assert.isNull(resolveTeam([], defaultScope(), 'T1'))
  })
})
