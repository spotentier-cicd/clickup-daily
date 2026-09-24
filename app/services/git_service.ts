import { homedir } from 'node:os'
import { existsSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { basename, dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { DateTime } from 'luxon'
import type { GitBranch } from '#domain/git/types'
import type { GitConfig } from '#domain/config/types'

const run = promisify(execFile)

/** ROC-180 ne doit pas capturer ROC-1801 : la borne est posée à l'usage. */
const BRANCH_REF = /[A-Za-z][A-Za-z0-9]{1,9}-\d{1,6}/g
const TRACK = /(ahead|behind) (\d+)/g

export interface GitServiceLogger {
  debug: (message: string) => void
  info: (message: string) => void
}

/**
 * Branches locales rattachées aux tickets. Lecture seule, aucun accès réseau,
 * aucun fetch : on ne regarde que ce qui est déjà sur le poste.
 */
export class GitService {
  /**
   * Index référence de ticket (minuscules) → branches locales qui la citent.
   *
   * Le logger est passé à l'appel : celui de la commande Ace et celui d'une
   * requête HTTP ne sont pas le même, et le service reste sans état, donc
   * constructible par le conteneur sans configuration.
   */
  async loadBranchIndex(
    config: GitConfig,
    zone: string,
    logger: GitServiceLogger
  ): Promise<Map<string, GitBranch[]>> {
    const index = new Map<string, GitBranch[]>()
    if (!config.enabled) return index

    const paths = config.repos.map(expandHome).filter((path) => {
      if (existsSync(join(path, '.git'))) return true
      logger.debug(`Dépôt git ignoré (introuvable) : ${path}`)
      return false
    })

    const labels = repoLabels(paths)

    for (const path of paths) {
      for (const branch of await this.#readBranches(path, labels.get(path)!, zone, logger)) {
        for (const token of branch.name.match(BRANCH_REF) ?? []) {
          const key = token.toLowerCase()
          index.set(key, [...(index.get(key) ?? []), branch])
        }
      }
    }

    logger.info(
      `Git : ${paths.length} dépôts, ${index.size} références de tickets trouvées dans les branches locales`
    )
    return index
  }

  async #readBranches(
    repo: string,
    label: string,
    zone: string,
    logger: GitServiceLogger
  ): Promise<GitBranch[]> {
    const format =
      '%(HEAD)\t%(refname:short)\t%(committerdate:iso8601)\t%(upstream:short)\t%(upstream:track)'
    const output = await this.#git(
      repo,
      ['for-each-ref', `--format=${format}`, 'refs/heads'],
      logger
    )
    if (output === null) return []

    /* Les fichiers modifiés ne se rattachent qu'à la branche courante. */
    const status = await this.#git(repo, ['status', '--porcelain', '--untracked-files=no'], logger)
    const dirty = (status ?? '').split('\n').filter((line) => line.trim()).length

    const branches: GitBranch[] = []
    for (const line of output.split('\n')) {
      const parts = line.split('\t')
      if (parts.length < 5) continue

      const [head, name, when, upstream, track] = parts
      const counts = new Map(
        [...track.matchAll(TRACK)].map((m) => [m[1], Number.parseInt(m[2], 10)])
      )
      const lastCommit = DateTime.fromFormat(when.trim(), 'yyyy-MM-dd HH:mm:ss ZZZ', {
        setZone: true,
      })
      const isCurrent = head.trim() === '*'

      if (!lastCommit.isValid) logger.debug(`Date de commit illisible (${when}) sur ${name}`)

      branches.push({
        repo: label,
        name,
        lastCommit: lastCommit.isValid ? lastCommit.setZone(zone) : null,
        upstream: upstream.trim(),
        ahead: counts.get('ahead') ?? 0,
        behind: counts.get('behind') ?? 0,
        isCurrent,
        dirty: isCurrent ? dirty : 0,
      })
    }

    return branches
  }

  async #git(repo: string, args: string[], logger: GitServiceLogger): Promise<string | null> {
    try {
      const { stdout } = await run('git', ['-C', repo, ...args], { timeout: 20_000 })
      return stdout
    } catch (error) {
      logger.debug(
        `git ${args.join(' ')} dans ${repo} : ${error instanceof Error ? error.message : error}`
      )
      return null
    }
  }
}

/**
 * Les branches d'une tâche, de la plus récente à la plus ancienne, plafonnées.
 */
export function branchesForTask(
  ref: string,
  index: Map<string, GitBranch[]>,
  maxBranches: number
): GitBranch[] {
  return [...(index.get(ref.toLowerCase()) ?? [])]
    .sort((a, b) => (b.lastCommit?.toMillis() ?? 0) - (a.lastCommit?.toMillis() ?? 0))
    .slice(0, maxBranches)
}

function expandHome(path: string): string {
  return resolve(path.startsWith('~') ? join(homedir(), path.slice(1)) : path)
}

/** « api » et « front » reviennent dans plusieurs projets : on préfixe au besoin. */
function repoLabels(paths: string[]): Map<string, string> {
  const counts = new Map<string, number>()
  for (const path of paths) {
    const name = basename(path)
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }

  return new Map(
    paths.map((path) => {
      const name = basename(path)
      return [path, counts.get(name)! === 1 ? name : `${basename(dirname(path))}/${name}`]
    })
  )
}
