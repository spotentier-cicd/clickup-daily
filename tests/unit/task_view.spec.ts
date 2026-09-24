import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { readFileSync } from 'node:fs'
import { isBug } from '#domain/rules/bugs'
import { toTaskView } from '#domain/task/view'
import { buildColumns } from '#domain/task/columns'
import clickUpDailyConfig from '#config/clickup_daily'
import type { RawTask, TaskView } from '#domain/task/types'

const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/sample.json', import.meta.url), 'utf8')
) as Record<string, RawTask[]> & { _custom_items: Record<string, string> }

const ME = 106607105
const NOW = DateTime.fromISO('2026-09-23T09:00:00', { zone: 'Europe/Paris' })
const COLUMNS = buildColumns(clickUpDailyConfig.columns)
const TYPE_NAMES = new Map(
  Object.entries(fixture._custom_items).map(([id, label]) => [Number(id), label])
)

/* Les espaces sont découverts en production ; la fixture en fournit trois. */
const SPACES: Record<string, { key: string; label: string }> = {
  ROC: { key: 'ROC', label: 'ROC' },
  ROCND: { key: 'ROCND', label: 'ROC New Deal' },
  TEMPO: { key: 'TEMPO', label: 'Tempo' },
}

function viewsOf(envKey: string): TaskView[] {
  return fixture[envKey].map((raw) =>
    toTaskView({
      raw,
      space: SPACES[envKey],
      columns: COLUMNS,
      config: clickUpDailyConfig,
      meUserId: ME,
      now: NOW,
      taskTypeNames: TYPE_NAMES,
    })
  )
}

function byRef(ref: string): TaskView {
  const found = [...viewsOf('ROC'), ...viewsOf('ROCND'), ...viewsOf('TEMPO')].find(
    (v) => v.ref === ref
  )
  if (!found) throw new Error(`tâche ${ref} absente de la fixture`)
  return found
}

test.group('toTaskView', () => {
  test('range dans « Autres » un statut que le workflow ne connaît pas', ({ assert }) => {
    /* ROC-1650 est en « production », qui n'est repris par aucune colonne. */
    const task = viewsOf('ROC').find((v) => v.ref === 'ROC-1650')!

    assert.exists(task, 'la tâche n’est plus écartée, elle est rangée à part')
    assert.equal(task.column, 'autres')
    assert.equal(task.columnLabel, 'Autres')
  })

  test('porte l’identité de sa liste', ({ assert }) => {
    const task = byRef('ROC-1801')

    assert.equal(task.listId, '901514487732')
    assert.equal(task.listName, 'Sprint 59 (9/15 - 10/5)')
  })

  test('remplit l’identité de la tâche', ({ assert }) => {
    const task = byRef('ROC-1801')
    assert.equal(task.envKey, 'ROC')
    assert.equal(task.envLabel, 'ROC')
    assert.equal(task.status, 'dev en cours')
    assert.equal(task.column, 'dev_en_cours')
    assert.equal(task.listName, 'Sprint 59 (9/15 - 10/5)')
    assert.equal(task.folderName, 'ROC Sprints')
  })

  test('reconnaît mes tâches, y compris à plusieurs assignés', ({ assert }) => {
    assert.isTrue(byRef('ROC-1801').isMine)
    assert.isTrue(byRef('TEMP0-620').isMine, 'je suis le second des deux assignés')
    assert.isFalse(byRef('ROC-1802').isMine)
  })

  test('résout le type de tâche, et laisse vide pour une tâche ordinaire', ({ assert }) => {
    assert.equal(byRef('ROC-1802').taskType, 'User Story')
    assert.equal(byRef('ROC-1801').taskType, 'Bug')
    assert.equal(byRef('ROC-1790').taskType, 'Tâche', 'custom_item_id vaut 0')
  })

  test('écarte les champs personnalisés au préfixe ignoré', ({ assert }) => {
    const names = byRef('ROC-1801').customFields.map((f) => f.name)
    assert.include(names, 'Section CODO')
    assert.notInclude(names, 'BASELINE_status')
  })

  test('rend lisibles les valeurs de champs personnalisés', ({ assert }) => {
    const section = byRef('ROC-1801').customFields.find((f) => f.name === 'Section CODO')
    assert.isDefined(section)
    assert.notInclude(section!.value, '69e20958', 'les identifiants de labels sont remplacés')
  })

  test('calcule le retard par rapport à la date donnée', ({ assert }) => {
    for (const task of [...viewsOf('ROC'), ...viewsOf('ROCND'), ...viewsOf('TEMPO')]) {
      if (task.due && task.due.startOf('day') < NOW.startOf('day')) {
        assert.isTrue(task.isOverdue, `${task.ref} est en retard`)
        assert.isAbove(task.overdueDays, 0)
      } else {
        assert.isFalse(task.isOverdue, `${task.ref} n’est pas en retard`)
        assert.equal(task.overdueDays, 0)
      }
    }
  })

  test('retombe sur l’id quand la tâche n’a pas de référence', ({ assert }) => {
    const task = toTaskView({
      raw: { id: '999', status: { status: 'a faire' }, name: 'Sans référence' },
      space: SPACES.ROC,
      columns: COLUMNS,
      config: clickUpDailyConfig,
      meUserId: ME,
      now: NOW,
    })
    assert.equal(task?.ref, '999')
    assert.equal(task?.url, 'https://app.clickup.com/t/999')
  })
})

test.group('isBug', () => {
  test('par type de tâche ClickUp', ({ assert }) => {
    assert.isTrue(byRef('ROC-1801').isBug)
  })

  test('par nom de liste', ({ assert }) => {
    const task = byRef('ROCND-702')
    assert.equal(task.taskType, 'Tâche', 'ce n’est pas le type qui le classe')
    assert.isTrue(task.isBug, 'la liste s’appelle « ROC ND bug maintenance »')
  })

  test('par tag et par préfixe de titre', ({ assert }) => {
    const base = { taskType: 'Tâche', listName: '', tags: [] as string[], name: 'Quelque chose' }
    assert.isTrue(isBug({ ...base, tags: ['Bug'] }, clickUpDailyConfig.bugs))
    assert.isTrue(isBug({ ...base, name: 'BUG : le total est faux' }, clickUpDailyConfig.bugs))
    assert.isFalse(isBug({ ...base, name: 'Debug du calcul' }, clickUpDailyConfig.bugs))
  })

  test('une user story ordinaire n’est pas un bug', ({ assert }) => {
    assert.isFalse(byRef('ROC-1802').isBug)
  })
})
