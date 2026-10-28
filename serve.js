/*
|--------------------------------------------------------------------------
| Point d'entrée JavaScript du serveur HTTP
|--------------------------------------------------------------------------
|
| Même rôle que ace.js pour les commandes : node ne sait pas exécuter du
| TypeScript, donc on enregistre le hook @poppinss/ts-exec avant d'importer
| bin/server.ts.
|
| POURQUOI DEPUIS LA RACINE, ET PAS DEPUIS build/.
|
| La base SQLite se résout par rapport à la racine de l'application —
| `app.tmpPath()`, donc tmp/db.sqlite3. Lancé depuis build/, le serveur
| ouvrirait build/tmp/db.sqlite3 : une SECONDE base, vide, pendant que la
| collecte du matin continuerait d'écrire dans l'autre. Et `node ace build`
| efface build/ avant de le remplir — la base y disparaîtrait au premier
| build suivant.
|
| Le serveur et la collecte partagent donc la même racine, le même .env et la
| même base, exactement comme quand on les lance à la main.
|
| Les ASSETS, eux, viennent du build : avec NODE_ENV=production, AdonisJS lit
| public/assets/.vite/manifest.json, que `npm run build` écrit à la racine. Un
| changement de front non reconstruit ne se verra donc pas.
|
|   NODE_ENV=production node serve.js
*/

import '@poppinss/ts-exec'

await import('./bin/server.js')
