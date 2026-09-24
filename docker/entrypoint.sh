#!/bin/sh
#
# Applique les migrations en attente, puis passe la main.
#
# Les migrations sont idempotentes : les rejouer à chaque démarrage coûte
# quelques millisecondes et évite d'avoir à s'en souvenir après une mise à jour.
set -e

node ace migration:run --force

exec "$@"
