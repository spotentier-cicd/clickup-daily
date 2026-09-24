# clickup-daily

Le point ClickUp du matin : ce qui bloque, ce qu'on doit relire, ce qui dort,
ce qu'on n'a pas pointé — et la veille technique du jour.

Un tableau de bord local, mono-utilisateur, en lecture seule sur ClickUp. Il ne
modifie jamais vos tâches.

## Démarrer

Il faut Node 24 ou plus récent.

```bash
npm install
cp .env.example .env
node ace generate:key          # remplit APP_KEY
```

Ouvrez `.env` et collez votre **jeton personnel ClickUp** dans
`CLICKUP_API_TOKEN`. Il se crée en une minute :
ClickUp → avatar → *Settings* → *Apps* → *API Token* → *Generate*. Un jeton
commence par `pk_`.

```bash
node ace migration:run
npm run dev
```

Le tableau de bord attend sur http://localhost:3333.

## Premier réglage

Au premier lancement rien n'est collecté : le projet ne devine pas ce qui vous
intéresse dans votre ClickUp. Ouvrez **/parametres** (l'engrenage en haut à
gauche).

La page lit votre arborescence réelle — équipes, espaces, dossiers, listes — et
vous cochez ce que vous voulez suivre :

- **une liste cochée** est collectée à chaque rapport et s'affiche dans le
  tableau ; la décocher l'en sort aussitôt, sans rien effacer ;
- **les statuts se choisissent liste par liste**, parce que c'est le niveau où
  ClickUp les définit : on peut vouloir voir « nouveau » dans le backlog mais
  pas dans les sprints ;
- **les statuts sont rattachés à une étape du workflow** (en cours, revue à
  faire, recette…). Le rattachement est deviné d'après le nom du statut, en
  français comme en anglais, et se corrige dans la même page.

Enregistrez, puis lancez une collecte :

```bash
node ace daily:report
```

ou cliquez **Rafraîchir** dans le tableau de bord.

Rien n'est écrit en dur nulle part : le jeton donne l'utilisateur, ses équipes
et son arborescence. Deux personnes clonent le même dépôt et obtiennent chacune
son tableau.

## Les commandes

```bash
node ace daily:report            # collecte et enregistre le rapport
node ace daily:report --no-git   # sans les branches locales
node ace daily:report --no-veille --no-temps --no-mentions --no-enrich
npm run dev                      # serveur de développement
npm run test                     # 134 tests unitaires, base isolée
npm run lint && npm run typecheck
```

## En conteneur

```bash
cp .env.example .env
# APP_KEY : openssl rand -base64 32
# CLICKUP_API_TOKEN : votre jeton pk_…
docker compose up -d --build
```

Le tableau attend sur http://localhost:3333 ; ouvrez **/parametres** pour
choisir ce que vous suivez, comme en local.

Deux services :

| | |
|---|---|
| `app` | sert le tableau de bord, applique les migrations au démarrage |
| `collector` | lance `daily:report --trigger scheduled` chaque jour ouvré |

L'heure et les jours de collecte se règlent dans `.env` :
`COLLECT_AT=08:00`, `COLLECT_DAYS=1,2,3,4,5` (1 = lundi), `TZ=Europe/Paris`.

```bash
docker compose logs -f collector             # suivre les collectes
docker compose exec app node ace daily:report  # collecter tout de suite
docker compose down                          # arrêter, en gardant les données
docker compose down -v                       # tout effacer, base comprise
```

La base SQLite et le cache de veille vivent dans le volume `data`, monté sur
`/app/tmp` : c'est le seul chemin à sauvegarder.

**Les branches git** ne sont pas visibles depuis un conteneur. Pour les
rapprocher des tickets, décommentez le montage `/repos` dans
`docker-compose.yml`, réglez `REPOS_DIR` dans `.env`, et renseignez
`git.repos` avec les chemins **vus du conteneur** (`/repos/mon-projet`). Sans
ça la section disparaît simplement des cartes.

**La notification macOS** ne fonctionne pas en conteneur : `osascript` n'y
existe pas. L'échec est avalé, la collecte n'en souffre pas.

## La collecte du matin, sans conteneur

```bash
./scripts/install-launchd.sh          # jours ouvrés à 8 h 00
./scripts/install-launchd.sh 7 30     # à 7 h 30
./scripts/install-launchd.sh --remove
```

Le script installe un agent launchd qui lance `daily:report --trigger
scheduled`. Le journal va dans `tmp/daily-report.log`.

Le déclencheur compte : `scheduled` est le seul qui déplace la **référence** de
« ce qui a changé ». Un clic sur « Rafraîchir » dans la journée compare donc
toujours au rapport du matin, pas au clic précédent.

Sans planificateur, la référence retombe sur le dernier rapport d'avant
aujourd'hui : « ce qui a changé » fonctionne quand même, simplement calé sur
votre dernière collecte plutôt que sur une heure fixe.

Sur un système sans launchd, une ligne de `crontab` fait la même chose :

```
0 8 * * 1-5 cd /chemin/vers/clickup-daily && /usr/bin/env node ace.js daily:report --trigger scheduled
```

## Ce qui reste en configuration

`config/clickup_daily.ts` ne contient rien qui soit propre à un workspace, mais
il porte les réglages de produit :

| Bloc | À quoi ça sert |
|---|---|
| `columns` | Les étapes du workflow, leurs libellés, leurs couleurs, et les mots qui servent à deviner le rattachement des statuts. Les règles de blocage visent ces clés. |
| `git.repos` | Chemins de dépôts locaux, pour rapprocher une branche d'un ticket par sa référence. **Vide par défaut** ; un dépôt introuvable est ignoré sans bruit. |
| `temps` | Heures attendues par jour et jours ouvrés, pour le suivi de pointage. |
| `blockers`, `staleAfterDays` | Les seuils : au bout de combien de jours une revue en souffrance, une tâche sans activité ou une recette qui dort remontent. |
| `mentions`, `enrich` | Profondeur de balayage des commentaires, plafonnée pour tenir le quota d'appels. |
| `veille` | Les flux RSS/Atom suivis et les mots-clés de votre stack. |

Une incohérence dans ce fichier fait échouer le démarrage avec un message
explicite, pas le rapport du matin.

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `CLICKUP_API_TOKEN` | **Obligatoire.** Votre jeton personnel `pk_…`. |
| `CLICKUP_TEAM_ID` | Facultatif. Force l'équipe quand votre jeton en voit plusieurs ; sinon elle se choisit dans /parametres. |
| `TZ` | Facultatif. Fuseau des journées ; celui de la machine par défaut. |
| `DB_FILENAME` | Facultatif. Nom du fichier SQLite dans `tmp/`. |

## Comment c'est fait

- `app/domain` — les règles, pures, sans I/O, partagées avec le navigateur.
  C'est là que vivent les blocages, le pointage, le diff, le périmètre.
- `app/services` — la collecte : ClickUp, git local, flux de veille.
- `app/controllers` — trois pages : le tableau, le paramétrage, le
  rafraîchissement.
- `inertia/` — React 19, Inertia, Tailwind v4.

Chaque collecte est archivée : on peut rouvrir le rapport d'un jour passé.
