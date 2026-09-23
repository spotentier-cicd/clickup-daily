import type { DateTime } from 'luxon'

/** Une branche locale rattachée à un ticket par la référence dans son nom. */
export interface GitBranch {
  repo: string
  name: string
  lastCommit: DateTime | null
  upstream: string
  ahead: number
  behind: number
  isCurrent: boolean
  /** Fichiers modifiés non commités — branche courante uniquement. */
  dirty: number
}

export function neverPushed(branch: GitBranch): boolean {
  return !branch.upstream
}

/** Du travail qui n'existe que sur ce poste. */
export function isUnpushed(branch: GitBranch): boolean {
  return neverPushed(branch) || branch.ahead > 0
}

/** Ce qui mérite d'être dit sur cette branche, ou une chaîne vide si tout est poussé. */
export function branchState(branch: GitBranch): string {
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
