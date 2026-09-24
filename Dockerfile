# ─────────────────────────────────────────────────────────────────────────────
# clickup-daily — image de production
#
# Trois étapes. La première compile : elle a besoin d'une chaîne C++ parce que
# better-sqlite3 est un module natif. La deuxième installe les dépendances de
# production dans le dossier `build/` produit par AdonisJS. La troisième ne
# garde que ça — l'image finale n'embarque ni compilateur, ni sources
# TypeScript, ni dépendances de développement.
# ─────────────────────────────────────────────────────────────────────────────

FROM node:24-slim AS build

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /src

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# `node ace build` valide la configuration au démarrage : on lui donne de quoi
# passer, sans secret réel. Ces valeurs sont posées SUR LA COMMANDE, pas sur
# l'image : elles n'entrent donc dans aucune couche.
RUN NODE_ENV=development \
    APP_KEY=cle_de_compilation_sans_aucune_valeur \
    CLICKUP_API_TOKEN=pk_compilation \
    HOST=127.0.0.1 \
    PORT=3333 \
    LOG_LEVEL=info \
    APP_URL=http://127.0.0.1:3333 \
    SESSION_DRIVER=cookie \
    node ace build

WORKDIR /src/build
RUN npm ci --omit=dev

# ─────────────────────────────────────────────────────────────────────────────

FROM node:24-slim AS runtime

# git : pour rapprocher les branches locales des tickets, si des dépôts sont
# montés dans le conteneur. tini : pour que Ctrl-C et `docker stop` arrivent
# vraiment au processus Node.
RUN apt-get update \
 && apt-get install -y --no-install-recommends git tini \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3333

WORKDIR /app

# --chown pendant la copie : un `chown -R` après coup réécrirait chaque fichier
# et dupliquerait les 400 Mo de l'application dans une seconde couche.
COPY --from=build --chown=node:node /src/build ./
COPY --chmod=755 docker/entrypoint.sh docker/collect.sh /usr/local/bin/
RUN mkdir -p /app/tmp && chown node:node /app/tmp

USER node
EXPOSE 3333

# La base et le cache de veille vivent ici : c'est le seul chemin à persister.
VOLUME ["/app/tmp"]

ENTRYPOINT ["/usr/bin/tini", "--", "entrypoint.sh"]
CMD ["node", "bin/server.js"]
