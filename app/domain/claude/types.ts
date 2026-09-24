import type { DateTime } from 'luxon'
import type { TokenUsage } from '#domain/claude/pricing'

/*
| CE QUE LES CONVERSATIONS ONT COÛTÉ.
|
| Sur un abonnement individuel, ce montant n'est facturé à personne : il répond
| à « qu'est-ce que ça aurait coûté au tarif de l'API ? ». C'est une mesure
| d'effort, pas une dépense, et l'affichage doit le dire.
|
| Comme le reste du contrat, le type est générique sur la représentation des
| dates : DateTime côté calcul, ISO côté transport.
*/

export type ClaudeModelUsage = {
  /** Identifiant normalisé, tel qu'il sert à chercher le tarif. */
  model: string
  usd: number
  tokens: TokenUsage
}

/** Un jour de la période, pour dessiner la pente du mois. */
export type ClaudeDayUsage = {
  /** Date locale, au format yyyy-MM-dd. */
  day: string
  usd: number
}

export type ClaudeUsageOf<D> = {
  since: D
  until: D
  totalUsd: number
  todayUsd: number
  byModel: ClaudeModelUsage[]
  byDay: ClaudeDayUsage[]
  /**
   * Par référence de ticket en minuscules (« roc-1801 »).
   *
   * Clé par référence et non par identifiant ClickUp : c'est ce qu'on sait
   * lire d'un nom de branche ou d'une conversation, et `TaskView.ref` porte la
   * même chose côté tâche. Une conversation citant plusieurs tickets répartit
   * son montant à parts égales entre eux.
   */
  byRef: Record<string, number>
  /** Ce qui n'a pu être rattaché à aucun ticket. */
  unattributedUsd: number
  /** Conversations distinctes ayant contribué à la période. */
  sessions: number
  /**
   * Modèles rencontrés mais absents de la grille tarifaire.
   *
   * Leur consommation n'est pas comptée dans le total : mieux vaut un montant
   * visiblement incomplet qu'un total faux sans que rien ne le dise.
   */
  unknownModels: string[]
}

export type ClaudeUsage = ClaudeUsageOf<DateTime>
