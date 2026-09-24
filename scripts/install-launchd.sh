#!/usr/bin/env bash
#
# Installe la collecte du matin dans launchd (macOS).
#
#   ./scripts/install-launchd.sh            # tous les jours ouvrés à 8 h 00
#   ./scripts/install-launchd.sh 7 30       # à 7 h 30
#   ./scripts/install-launchd.sh --remove   # désinstalle
#
set -euo pipefail

PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="com.clickup-daily.$(id -un)"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

if [ "${1:-}" = "--remove" ]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Collecte planifiée retirée."
  exit 0
fi

HOUR="${1:-8}"
MINUTE="${2:-0}"
NODE="$(command -v node)"

if [ -z "$NODE" ]; then
  echo "node est introuvable dans le PATH." >&2
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents"
sed -e "s|__LABEL__|$LABEL|g" \
    -e "s|__NODE__|$NODE|g" \
    -e "s|__PROJECT__|$PROJECT|g" \
    -e "s|__HOUR__|$HOUR|g" \
    -e "s|__MINUTE__|$MINUTE|g" \
    "$PROJECT/scripts/clickup-daily.plist.template" > "$PLIST"

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

printf 'Collecte planifiée : tous les jours ouvrés à %02d h %02d.\n' "$HOUR" "$MINUTE"
echo "  journal      : $PROJECT/tmp/daily-report.log"
echo "  vérifier     : launchctl print gui/$(id -u)/$LABEL | head"
echo "  lancer maintenant : launchctl kickstart -k gui/$(id -u)/$LABEL"
echo "  retirer      : ./scripts/install-launchd.sh --remove"
