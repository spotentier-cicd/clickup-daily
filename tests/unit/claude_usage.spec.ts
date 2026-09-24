import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import { DateTime } from 'luxon'
import { buildClaudeUsage } from '#domain/claude/aggregate'
import { emptyUsage } from '#domain/claude/pricing'
import { ClaudeUsageService } from '#services/claude_usage_service'
import type { ClaudeEntry } from '#domain/claude/aggregate'
import type { TokenUsage } from '#domain/claude/pricing'

const ZONE = 'Europe/Paris'
const NOW = DateTime.fromISO('2026-05-20T09:00:00', { zone: ZONE })
const SINCE = NOW.startOf('month')
const UNTIL = SINCE.plus({ months: 1 })

type EntryOverrides = Omit<Partial<ClaudeEntry>, 'usage'> & { usage: Partial<TokenUsage> }

function entry(partial: EntryOverrides): ClaudeEntry {
  return {
    at: DateTime.fromISO('2026-05-12T10:00:00', { zone: ZONE }),
    model: 'claude-sonnet-5',
    refs: [],
    sessionId: 'S1',
    ...partial,
    usage: { ...emptyUsage(), ...partial.usage },
  }
}

test.group('Coût Claude — l’agrégation', () => {
  test('ce qui précède le mois ne compte pas', ({ assert }) => {
    const usage = buildClaudeUsage(
      [
        entry({
          at: DateTime.fromISO('2026-04-30T23:59:00', { zone: ZONE }),
          usage: { output: 1e6 },
        }),
        entry({ usage: { output: 1e6 } }),
      ],
      { since: SINCE, until: UNTIL, now: NOW }
    )

    assert.closeTo(usage.totalUsd, 10, 1e-6)
  })

  test('un ticket cité seul reçoit tout', ({ assert }) => {
    const usage = buildClaudeUsage([entry({ refs: ['roc-42'], usage: { output: 1e6 } })], {
      since: SINCE,
      until: UNTIL,
      now: NOW,
    })

    assert.closeTo(usage.byRef['roc-42'], 10, 1e-6)
    assert.equal(usage.unattributedUsd, 0)
  })

  test('deux tickets dans la même journée se partagent la note', ({ assert }) => {
    /* Sans partage, la somme des tickets dépasserait le total réel. */
    const usage = buildClaudeUsage(
      [entry({ refs: ['roc-42', 'rocnd-7'], usage: { output: 1e6 } })],
      { since: SINCE, until: UNTIL, now: NOW }
    )

    assert.closeTo(usage.byRef['roc-42'], 5, 1e-6)
    assert.closeTo(usage.byRef['rocnd-7'], 5, 1e-6)
    assert.closeTo(usage.totalUsd, 10, 1e-6)
  })

  test('ce qui ne cite aucun ticket reste à part', ({ assert }) => {
    const usage = buildClaudeUsage(
      [entry({ usage: { output: 1e6 } }), entry({ refs: ['roc-42'], usage: { output: 1e6 } })],
      { since: SINCE, until: UNTIL, now: NOW }
    )

    assert.closeTo(usage.unattributedUsd, 10, 1e-6)
    assert.closeTo(usage.totalUsd, 20, 1e-6)
  })

  test('un modèle inconnu se signale et ne gonfle pas le total', ({ assert }) => {
    const usage = buildClaudeUsage(
      [
        entry({ model: 'claude-mystere-9', usage: { output: 1e6 } }),
        entry({ usage: { output: 1e6 } }),
      ],
      { since: SINCE, until: UNTIL, now: NOW }
    )

    assert.deepEqual(usage.unknownModels, ['claude-mystere-9'])
    assert.closeTo(usage.totalUsd, 10, 1e-6)
  })

  test('les messages fabriqués par le client sont ignorés sans bruit', ({ assert }) => {
    const usage = buildClaudeUsage([entry({ model: '<synthetic>', usage: {} })], {
      since: SINCE,
      until: UNTIL,
      now: NOW,
    })

    assert.equal(usage.totalUsd, 0)
    assert.isEmpty(usage.unknownModels)
    assert.equal(usage.sessions, 0)
  })

  test('la journée en cours se distingue du mois', ({ assert }) => {
    const usage = buildClaudeUsage(
      [entry({ usage: { output: 1e6 } }), entry({ at: NOW, usage: { output: 2e6 } })],
      { since: SINCE, until: UNTIL, now: NOW }
    )

    assert.closeTo(usage.totalUsd, 30, 1e-6)
    assert.closeTo(usage.todayUsd, 20, 1e-6)
    assert.lengthOf(usage.byDay, 2)
  })
})

/*
| Une transcription synthétique, aux compteurs ronds.
|
| Surtout pas un extrait réel : ces fichiers portent des noms, des chemins et
| le contenu des conversations.
*/
function transcript(): string {
  const branch = 'feature/ROC-42-refonte'
  const sonnet = {
    input_tokens: 1000,
    output_tokens: 2000,
    cache_read_input_tokens: 10_000,
    cache_creation_input_tokens: 12_000,
    cache_creation: { ephemeral_5m_input_tokens: 4000, ephemeral_1h_input_tokens: 8000 },
  }

  const lines = [
    /* La même réponse, écrite trois fois — une ligne par bloc de contenu. */
    ...[0, 1, 2].map(() => ({
      type: 'assistant',
      sessionId: 'S1',
      timestamp: '2026-05-12T08:00:00.000Z',
      gitBranch: branch,
      message: { id: 'msg_a', model: 'claude-sonnet-5', usage: sonnet },
    })),
    {
      type: 'user',
      sessionId: 'S1',
      timestamp: '2026-05-12T08:05:00.000Z',
      message: { content: [{ type: 'text', text: 'voir ROCND-7, pas comme GPT-4' }] },
    },
    {
      type: 'assistant',
      sessionId: 'S1',
      timestamp: '2026-05-12T08:10:00.000Z',
      message: { id: 'msg_x', model: 'claude-mystere-9', usage: { output_tokens: 1000 } },
    },
    {
      type: 'assistant',
      sessionId: 'S1',
      timestamp: '2026-05-12T08:11:00.000Z',
      message: { id: 'msg_s', model: '<synthetic>', usage: { output_tokens: 0 } },
    },
    /* Un autre jour, sans branche ni citation : rien à rattacher. */
    {
      type: 'assistant',
      sessionId: 'S1',
      timestamp: '2026-05-20T08:00:00.000Z',
      message: {
        id: 'msg_b',
        model: 'claude-haiku-4-5-20251001',
        usage: { input_tokens: 1000, output_tokens: 1000 },
      },
    },
    /* Le mois précédent : hors période. */
    {
      type: 'assistant',
      sessionId: 'S1',
      timestamp: '2026-04-15T08:00:00.000Z',
      gitBranch: branch,
      message: { id: 'msg_vieux', model: 'claude-sonnet-5', usage: { output_tokens: 1_000_000 } },
    },
    'ceci n’est pas du JSON',
  ]

  return lines.map((line) => (typeof line === 'string' ? line : JSON.stringify(line))).join('\n')
}

test.group('Coût Claude — la lecture des transcriptions', (group) => {
  const root = app.tmpPath('test-transcripts')
  const silence = { debug: () => {}, info: () => {} }
  const config = {
    transcriptsPath: root,
    includeSubagents: true,
    scanMessageText: true,
  }

  group.each.setup(async () => {
    await mkdir(join(root, 'projet'), { recursive: true })
    await writeFile(join(root, 'projet', 'S1.jsonl'), transcript(), 'utf8')
    return () => rm(root, { recursive: true, force: true })
  })

  test('une réponse écrite en plusieurs blocs n’est comptée qu’une fois', async ({ assert }) => {
    const usage = await new ClaudeUsageService().collect({
      config,
      zone: ZONE,
      now: NOW,
      logger: silence,
      knownPrefixes: ['roc', 'rocnd'],
    })

    /*
     * Sonnet 5 : 1 000 entrée (0,002 $) + 2 000 sortie (0,02 $) + 10 000 lus
     * (0,002 $) + 4 000 écrits court (0,01 $) + 8 000 écrits long (0,032 $).
     * Puis Haiku le 20 : 1 000 entrée (0,001 $) + 1 000 sortie (0,005 $).
     */
    assert.closeTo(usage!.totalUsd, 0.072, 1e-9)
    assert.closeTo(usage!.todayUsd, 0.006, 1e-9)
    assert.equal(usage!.sessions, 1)
  })

  test('les deux durées de cache sont lues séparément', async ({ assert }) => {
    const usage = await new ClaudeUsageService().collect({
      config,
      zone: ZONE,
      now: NOW,
      logger: silence,
    })

    const sonnet = usage!.byModel.find((model) => model.model === 'claude-sonnet-5')
    assert.equal(sonnet!.tokens.cacheWrite5m, 4000)
    assert.equal(sonnet!.tokens.cacheWrite1h, 8000)
  })

  test('la branche et le ticket cité se partagent la journée', async ({ assert }) => {
    const usage = await new ClaudeUsageService().collect({
      config,
      zone: ZONE,
      now: NOW,
      logger: silence,
      knownPrefixes: ['roc', 'rocnd'],
    })

    assert.closeTo(usage!.byRef['roc-42'], 0.033, 1e-9)
    assert.closeTo(usage!.byRef['rocnd-7'], 0.033, 1e-9)
    /* Le 20, sans branche ni citation. */
    assert.closeTo(usage!.unattributedUsd, 0.006, 1e-9)
  })

  test('un préfixe qui n’existe pas dans ClickUp n’est pas un ticket', async ({ assert }) => {
    const usage = await new ClaudeUsageService().collect({
      config,
      zone: ZONE,
      now: NOW,
      logger: silence,
      knownPrefixes: ['roc', 'rocnd'],
    })

    assert.notProperty(usage!.byRef, 'gpt-4')
  })

  test('un modèle hors grille est signalé, pas compté', async ({ assert }) => {
    const usage = await new ClaudeUsageService().collect({
      config,
      zone: ZONE,
      now: NOW,
      logger: silence,
    })

    assert.deepEqual(usage!.unknownModels, ['claude-mystere-9'])
  })

  test('une racine absente rend null plutôt que d’échouer', async ({ assert }) => {
    const usage = await new ClaudeUsageService().collect({
      config: { ...config, transcriptsPath: join(root, 'nulle-part') },
      zone: ZONE,
      now: NOW,
      logger: silence,
    })

    assert.isNull(usage)
  })
})
