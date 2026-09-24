/*
| CE QU'EST UNE RÉFÉRENCE DE TICKET.
|
| « ROC-1801 » : un préfixe de projet, un tiret, un numéro. On la retrouve dans
| le custom_id ClickUp, dans les noms de branches locales, et dans le texte des
| conversations Claude Code.
|
| Cette définition vivait dans le service git, qui était seul à s'en servir.
| Elle sert maintenant aussi à rattacher une conversation à un ticket : elle
| remonte donc ici, pour qu'il n'y ait pas deux idées légèrement différentes de
| ce qu'est une référence selon l'endroit où on la cherche.
*/

/** ROC-180 ne doit pas capturer ROC-1801 : la borne est posée à l'usage. */
export const TASK_REF = /[A-Za-z][A-Za-z0-9]{1,9}-\d{1,6}/g

/** La même chose, ancrée : pour valider un jeton entier plutôt que le chercher. */
const WHOLE_REF = /^[A-Za-z][A-Za-z0-9]{1,9}-\d{1,6}$/

/** Une tâche ClickUp citée par son lien plutôt que par sa référence. */
const CLICKUP_TASK_URL = /app\.clickup\.com\/t\/(?:\d+\/)?([A-Za-z0-9-]+)/g

/**
 * Les références citées dans un texte, en minuscules et sans doublon.
 *
 * L'index des branches est déjà tenu en minuscules ; tout ce qui se compare à
 * une référence passe donc par ici pour ne pas avoir à y penser deux fois.
 */
export function refsIn(text: string): string[] {
  if (!text) return []

  const found = new Set<string>()

  for (const token of text.match(TASK_REF) ?? []) {
    found.add(token.toLowerCase())
  }

  /*
   * Le dernier segment d'un lien ClickUp est soit la référence lisible
   * (/t/9015220362/ROC-1712), soit l'identifiant interne (/t/86c1aaaa1). Le
   * premier cas est déjà pris par TASK_REF ; le second n'a rien à faire ici,
   * il se rattache par identifiant, pas par référence.
   */
  for (const [, tail] of text.matchAll(CLICKUP_TASK_URL)) {
    if (WHOLE_REF.test(tail)) found.add(tail.toLowerCase())
  }

  return [...found]
}
