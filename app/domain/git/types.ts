import type { DateTime } from 'luxon'

/** Une branche locale rattachée à un ticket par la référence dans son nom. */
export type GitBranchOf<D> = {
  repo: string
  name: string
  lastCommit: D | null
  upstream: string
  ahead: number
  behind: number
  isCurrent: boolean
  /** Fichiers modifiés non commités — branche courante uniquement. */
  dirty: number
}

export type GitBranch = GitBranchOf<DateTime>

export function neverPushed(branch: GitBranchOf<unknown>): boolean {
  return !branch.upstream
}

/** Du travail qui n'existe que sur ce poste. */
export function isUnpushed(branch: GitBranchOf<unknown>): boolean {
  return neverPushed(branch) || branch.ahead > 0
}

/** Ce qui mérite d'être dit sur cette branche, ou une chaîne vide si tout est poussé. */
export function branchState(branch: GitBranchOf<unknown>): string {
  const bits: string[] = []

  if (neverPushed(branch)) {
    bits.push('jamais poussée')
  } else if (branch.ahead) {
    bits.push(
      `${branch.ahead} commit${branch.ahead > 1 ? 's' : ''} non poussé${branch.ahead > 1 ? 's' : ''}`
    )
  }
  if (branch.dirty) {
    bits.push(
      `${branch.dirty} fichier${branch.dirty > 1 ? 's' : ''} modifié${branch.dirty > 1 ? 's' : ''}`
    )
  }
  if (branch.behind) {
    bits.push(`${branch.behind} en retard`)
  }

  return bits.join(' · ')
}
