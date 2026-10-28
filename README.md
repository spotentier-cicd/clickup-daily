# clickup-daily

Le point ClickUp du matin : ce qui bloque, ce qu'on doit relire, ce qui dort,
ce qu'on n'a pas pointé — et la veille technique du jour.

Un tableau de bord local, mono-utilisateur, en lecture seule sur ClickUp. Il ne
modifie jamais vos tâches. La seule chose qu'on y écrit soi-même est son
tableau personnel — et elle reste sur sa machine.

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
intéresse dans votre ClickUp. Ouvrez **/parametres** (menu du compte, en haut à
droite de la barre).

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

## Installer l'application

Le tableau s'installe comme une application : une fenêtre à elle, sans barre
d'adresse, et une icône dans le dock ou sur l'écran d'accueil. Dans Chrome ou
Edge, l'icône d'installation apparaît au bout de la barre d'adresse ; dans
Safari, *Fichier → Ajouter au Dock*.

L'installation demande un **service worker**, et celui-ci ne s'enregistre
qu'en production — `npm run dev` n'en pose pas, pour ne pas s'intercaler entre
Vite et le navigateur. Installez donc depuis le conteneur (`docker compose up
-d`), ou depuis un build servi localement.

Ce qui est installé reste **une fenêtre sur le serveur** : rien n'est mis en
cache de ce que le tableau affiche. C'est la même règle que le bandeau « ce
rapport date du… » — des tickets d'avant-hier affichés sans le dire valent
moins que rien. Serveur éteint, l'application s'ouvre donc sur une page qui le
dit, avec un bouton pour réessayer. Seuls les fichiers de build sont gardés,
et uniquement parce que leur nom porte l'empreinte de leur contenu : une
version en cache ne peut pas être la mauvaise.

| Fichier | Rôle |
|---|---|
| `public/manifest.webmanifest` | Nom, icônes, couleurs, raccourci vers le paramétrage. |
| `public/sw.js` | Ce qui est mis en cache, et surtout ce qui ne l'est pas. **Incrémentez `VERSION`** en touchant à `offline.html`. |
| `public/offline.html` | La page servie quand le serveur ne répond pas. Autonome : aucun fichier à aller chercher. |
| `scripts/make-icons.mjs` | Regénère les quatre PNG à partir des formes de `favicon.svg`. Sans dépendance. |

## Les commandes

```bash
node ace daily:report            # collecte et enregistre le rapport
node ace daily:report --no-git   # sans les branches locales
node ace daily:report --no-veille --no-temps --no-mentions --no-enrich
node ace claude:usage            # coût des conversations Claude Code du mois
node ace claude:usage --verify   # contrôle la grille tarifaire (voir plus bas)
npm run dev                      # serveur de développement
npm run test                     # 194 tests unitaires, base isolée
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
| `claude` | Où sont les transcriptions Claude Code, et comment rattacher une conversation à un ticket. L'interrupteur, lui, est dans /parametres. |

Une incohérence dans ce fichier fait échouer le démarrage avec un message
explicite, pas le rapport du matin.

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `CLICKUP_API_TOKEN` | **Obligatoire.** Votre jeton personnel `pk_…`. |
| `CLICKUP_TEAM_ID` | Facultatif. Force l'équipe quand votre jeton en voit plusieurs ; sinon elle se choisit dans /parametres. |
| `TZ` | Facultatif. Fuseau des journées ; celui de la machine par défaut. |
| `DB_FILENAME` | Facultatif. Nom du fichier SQLite dans `tmp/`. |
| `CLAUDE_TRANSCRIPTS_PATH` | Facultatif. Racine des transcriptions Claude Code. `~/.claude/projects` par défaut ; à renseigner en conteneur. |

## Mon tableau

L'onglet **Mon tableau** est un kanban à cinq colonnes — *à faire*, *en
cours*, *bloqué*, *à déployer*, *à tester* — et c'est la seule partie de
l'application qu'on remplit soi-même. Rien n'en repart vers ClickUp : c'est un bloc-notes de poste de
travail, gardé dans la même base SQLite que les rapports.

Une carte porte ce qu'il faut pour reprendre une tâche là où on l'a laissée :

| | |
|---|---|
| le ticket | `ROC-1801`, pris dans ce que la collecte a ramené |
| les branches | `feature/ROC-1801`, côté front, côté back, ou les deux |
| le commentaire | où on en est, ce qu'on attend, ce qui bloque |

**Taper une référence connue remplit le reste** : l'intitulé prend le nom du
ticket s'il est encore vide. Les branches ne s'écrivent pas — leur nom se
déduit de la référence, `feature/ROC-1801`, et on ne coche que les côtés que
le ticket touche. Quand la collecte a vu cette branche dans un dépôt local, le
formulaire le dit. Le ticket n'est pas obligatoire : on note « relancer
l'infra » avant qu'un ticket existe, et l'intitulé seul suffit alors — sans
référence, il n'y a simplement pas de branche à cocher.

Une carte se déplace **à la souris** — elle s'affiche à la place qu'elle
prendra pendant qu'on la glisse — ou **aux flèches ← →** de la carte, qui la
passent à la colonne voisine. Un clic sur la référence ouvre la fiche du ticket
sur place ; un clic sur un nom de branche le copie, prêt pour un `git
checkout`.

Une carte **survit à son ticket** : la tâche se ferme, sort du périmètre ou
part en archive, la carte reste telle qu'on l'a écrite. C'est ce qui la
distingue du reste du tableau de bord, qui n'est qu'un reflet de ClickUp. Il
n'y a pas de colonne « terminé » : une carte finie se supprime, et la
suppression se confirme dans la carte.

## Le coût des conversations Claude

Le tableau affiche ce que vos conversations Claude Code ont coûté ce mois-ci, au
total et ticket par ticket. La case **« Coût des conversations Claude »**, en bas
de /parametres, l'allume et l'éteint. Elle est **décochée par défaut** : cette
partie lit des fichiers du dossier personnel, hors du projet, et ça se demande
plutôt que ça ne se suppose. Décochée, on ne lit plus les transcriptions à la
collecte et la carte disparaît aussitôt du tableau ; les rapports déjà
enregistrés gardent leur valeur, recocher suffit à tout retrouver.

**C'est un équivalent, pas une facture.** Un abonnement Claude est à prix fixe :
rien de ce montant n'est prélevé. Il répond à « qu'est-ce que ça aurait coûté au
tarif de l'API ? », et c'est une mesure d'effort.

Il n'y a pas d'autre moyen de l'obtenir. L'API d'administration d'Anthropic
(`/v1/organizations/usage_report`, `/v1/organizations/cost_report`) est réservée
aux organisations et explicitement fermée aux comptes individuels, et aucun
endpoint public n'expose la consommation d'un abonnement Pro/Max. La source est
donc locale : les transcriptions que Claude Code écrit dans `~/.claude/projects`,
lues en lecture seule.

**Aucun texte de conversation n'est conservé.** Le service y cherche des
références de tickets et ne garde que celles-ci ; ni les prompts, ni les
réponses, ni les résultats d'outils n'entrent en base.

### Le rattachement à un ticket

Deux signaux, dans cet ordre :

1. **La branche git** de la conversation. Une branche `feature/ROC-1801-refonte`
   rattache la journée au ticket ROC-1801.
2. **Les tickets cités** dans les messages — `ROCND-701`, ou un lien
   `app.clickup.com/t/…`.

Une référence n'est retenue que si son préfixe existe vraiment dans votre
workspace : sans ce garde-fou, « GPT-4 » et le segment d'une URL passeraient pour
des tickets. Une journée qui cite plusieurs tickets partage son montant entre eux
plutôt que de le compter plusieurs fois.

Travailler sur `main` sans citer de ticket est donc normal, et tombe dans « sans
ticket identifié ». La carte l'affiche tel quel : mieux vaut un total franchement
incomplet qu'une imputation inventée.

### Deux limites, mesurables

`node ace claude:usage --verify` les mesure toutes les deux sur vos propres
données, sans rien envoyer nulle part :

- **La grille tarifaire** est reprise de la documentation publique et datée dans
  `app/domain/claude/pricing.ts`. La commande lui applique les compteurs de
  tokens que Claude Code a lui-même écrits, et compare au montant qu'il a
  facturé : les deux doivent coïncider. Un modèle absent de la grille n'est
  jamais compté zéro — il s'affiche sur la carte.
- **La couverture** est d'environ 90 %. Claude Code facture aussi des appels
  auxiliaires — la génération du titre d'une conversation, en Haiku — qu'il
  n'inscrit pas comme des réponses dans la transcription. Ils sont donc
  irrécupérables, et le montant affiché est un plancher.

## Comment c'est fait

- `app/domain` — les règles, pures, sans I/O, partagées avec le navigateur.
  C'est là que vivent les blocages, le pointage, le diff, le périmètre.
- `app/services` — la collecte : ClickUp, git local, flux de veille,
  transcriptions Claude Code.
- `app/controllers` — le tableau, le paramétrage, le rafraîchissement, et les
  écritures du tableau personnel.
- `inertia/` — React 19, Inertia, Tailwind v4. La barre bleu nuit et le notch
  qui porte le sélecteur de module sont dans `components/topbar.tsx` et
  `components/notch_nav.tsx` ; `lib/modules.ts` dit comment les onglets s'y
  rangent.
- `public/` — le favicon, et de quoi installer l'application (manifeste,
  icônes, service worker, page hors ligne).

Chaque collecte est archivée : on peut rouvrir le rapport d'un jour passé.
