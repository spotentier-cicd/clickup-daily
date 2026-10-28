#!/usr/bin/env bash
#
# Installe les deux agents launchd (macOS) :
#
#   — le TABLEAU, lancé à l'ouverture de session et maintenu en vie ;
#   — la COLLECTE du matin, en semaine à l'heure dite.
#
# Les deux partagent la racine du projet, donc le même .env et la même base.
#
#   ./scripts/install-launchd.sh             # collecte à 8 h 00
#   ./scripts/install-launchd.sh 7 30        # collecte à 7 h 30
#   ./scripts/install-launchd.sh --remove    # désinstalle les deux
#
set -euo pipefail

PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
USER_ID="$(id -u)"
LABEL="com.clickup-daily.$(id -un)"
SERVER_LABEL="com.clickup-daily-server.$(id -un)"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
SERVER_PLIST="$HOME/Library/LaunchAgents/$SERVER_LABEL.plist"

if [ "${1:-}" = "--remove" ]; then
  for label in "$SERVER_LABEL" "$LABEL"; do
    launchctl bootout "gui/$USER_ID/$label" 2>/dev/null || true
  done
  rm -f "$PLIST" "$SERVER_PLIST"
  echo "Tableau et collecte retirés du démarrage."
  exit 0
fi

HOUR="${1:-8}"
MINUTE="${2:-0}"
NODE="$(command -v node || true)"

if [ -z "$NODE" ]; then
  echo "node est introuvable dans le PATH." >&2
  exit 1
fi

# Le serveur sert les fichiers du build ; sans eux, chaque page serait une 500.
if [ ! -f "$PROJECT/public/assets/.vite/manifest.json" ]; then
  echo "Les fichiers de build manquent. Lancez d'abord :" >&2
  echo "  npm run build" >&2
  exit 1
fi

# launchd ne donne presque rien comme PATH : on y remet node et les usuels.
PATH_FOR_AGENT="$(dirname "$NODE"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

mkdir -p "$HOME/Library/LaunchAgents" "$PROJECT/tmp"

render() {
  sed -e "s|__LABEL__|$2|g" \
    -e "s|__NODE__|$NODE|g" \
    -e "s|__PROJECT__|$PROJECT|g" \
    -e "s|__PATH__|$PATH_FOR_AGENT|g" \
    -e "s|__HOUR__|$HOUR|g" \
    -e "s|__MINUTE__|$MINUTE|g" \
    "$PROJECT/scripts/$1" >"$3"
}

render clickup-daily-server.plist.template "$SERVER_LABEL" "$SERVER_PLIST"
render clickup-daily.plist.template "$LABEL" "$PLIST"

for pair in "$SERVER_LABEL:$SERVER_PLIST" "$LABEL:$PLIST"; do
  label="${pair%%:*}"
  plist="${pair#*:}"
  launchctl bootout "gui/$USER_ID/$label" 2>/dev/null || true
  launchctl bootstrap "gui/$USER_ID" "$plist"
done

PORT="$(sed -n 's/^PORT=\([0-9]*\).*/\1/p' "$PROJECT/.env" 2>/dev/null | head -1)"
PORT="${PORT:-3333}"

#
# macOS protège ~/Documents, ~/Desktop et ~/Downloads : un agent lancé par
# launchd n'hérite PAS de l'autorisation du Terminal, et se prend un
# « Operation not permitted » sur le premier fichier du projet. Rien ne peut
# le contourner depuis le code — l'autorisation se donne à la main, une fois.
#
# Sans ce contrôle, l'agent échouerait en silence : c'est exactement ce qui
# est arrivé à la version précédente du projet, dont la collecte planifiée
# n'a jamais tourné.
#
acces_refuse() {
  grep -qE 'EPERM|not permitted' "$PROJECT/tmp/server.log" 2>/dev/null
}

: >"$PROJECT/tmp/server.log"
sleep 4

if acces_refuse; then
  launchctl bootout "gui/$USER_ID/$SERVER_LABEL" 2>/dev/null || true
  cat <<MESSAGE

⚠ macOS refuse au service l'accès au projet.

  Le projet est dans ~/Documents, que macOS protège : un agent lancé au
  démarrage n'a pas l'autorisation du Terminal, et ne peut pas lire ses
  propres fichiers. Les deux agents sont installés et corrects, mais NI le
  tableau NI la collecte ne tourneront tant que l'accès n'est pas accordé —
  et la collecte, elle, échouerait sans rien dire.

  Dans Réglages Système → Confidentialité et sécurité → Accès complet au
  disque, ajoutez :

      $NODE

  (Cmd+Maj+G dans le sélecteur de fichiers pour coller le chemin.)

  Puis relancez ce script. Il n'a pas laissé le service boucler.

  Deux autres chemins, si vous préférez ne rien autoriser :
    — déplacer le projet hors de ~/Documents (~/projets, par exemple) ;
    — passer par Docker : « docker compose up -d » et Docker Desktop réglé
      pour s'ouvrir à la session. Attention, la base y est un volume Docker,
      distincte de tmp/db.sqlite3.

MESSAGE
  exit 1
fi

echo "Tableau : lancé à chaque ouverture de session, sur http://localhost:$PORT"
printf 'Collecte : tous les jours ouvrés à %02d h %02d.\n' "$HOUR" "$MINUTE"
echo
echo "  journaux     : $PROJECT/tmp/server.log · $PROJECT/tmp/daily-report.log"
echo "  état         : launchctl print gui/$USER_ID/$SERVER_LABEL | head"
echo "  redémarrer   : launchctl kickstart -k gui/$USER_ID/$SERVER_LABEL"
echo "  pause        : launchctl bootout gui/$USER_ID/$SERVER_LABEL"
echo "  reprise      : launchctl bootstrap gui/$USER_ID $SERVER_PLIST"
echo "  tout retirer : ./scripts/install-launchd.sh --remove"

# Un `npm run dev` déjà sur le port empêcherait l'agent de s'y attacher.
if lsof -ti ":$PORT" >/dev/null 2>&1; then
  OWNER="$(lsof -ti ":$PORT" | head -1)"
  if ! ps -p "$OWNER" -o command= | grep -q 'serve\.js'; then
    echo
    echo "⚠ Le port $PORT est déjà pris par le processus $OWNER — un « npm run dev » ?"
    echo "  L'agent réessaiera toutes les 10 s et prendra la main dès qu'il sera libre."
  fi
fi
