#!/bin/sh
#
# La collecte du matin, dans un conteneur.
#
#   COLLECT_AT    heure de la collecte, HH:MM        (défaut 08:00)
#   COLLECT_DAYS  jours de la semaine, 1=lundi       (défaut 1,2,3,4,5)
#
# Le déclencheur « scheduled » est ce qui donne un sens à « ce qui a changé » :
# la comparaison se fait d'un matin à l'autre, et un clic sur « Rafraîchir »
# dans la journée ne déplace pas la référence.
set -e

AT="${COLLECT_AT:-08:00}"
DAYS="${COLLECT_DAYS:-1,2,3,4,5}"

echo "Collecte planifiée à ${AT}, jours ${DAYS} (fuseau ${TZ:-UTC})."

while true; do
  now=$(date +%s)
  next=$(date -d "today ${AT}" +%s)
  [ "$next" -le "$now" ] && next=$(date -d "tomorrow ${AT}" +%s)

  sleep $((next - now))

  today=$(date +%u)
  case ",${DAYS}," in
    *",${today},"*)
      echo "--- $(date '+%Y-%m-%d %H:%M') collecte"
      node ace daily:report --trigger scheduled --no-notify || echo "collecte en échec"
      ;;
    *)
      echo "--- $(date '+%Y-%m-%d %H:%M') jour non ouvré, on saute"
      ;;
  esac

  # Repasser la minute en cours, pour ne pas relancer la même occurrence.
  sleep 61
done
