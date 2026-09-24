import type { ClickUpDailyConfig } from '#domain/config/types'

/*
| Configuration de clickup-daily.
|
| CE FICHIER NE CONTIENT RIEN QUI SOIT PROPRE À UN WORKSPACE. Le jeton suffit :
| l'utilisateur, l'équipe, les espaces, les dossiers, les listes et leurs
| statuts sont tous découverts via l'API, et ce qu'on en suit se règle dans
| /parametres. Ne restent ici que des RÉGLAGES DE PRODUIT — la forme du
| workflow, les seuils, les sources de veille — qu'on assume d'ouvrir dans un
| éditeur plutôt que dans une page.
|
| Le « satisfies » garde l'autocomplétion et fait échouer le typecheck sur une
| clé inconnue ; les règles que les types ne savent pas exprimer sont vérifiées
| au démarrage par checkConfigInvariants.
*/
const clickUpDailyConfig = {
  /*
   * Le fuseau sert à dater les journées : « hier » et « cette semaine » n'ont
   * de sens que quelque part. Celui de la machine par défaut, TZ pour forcer.
   */
  timezone: process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',

  /*
   * Les étapes du workflow, dans l'ordre. Ce sont elles que lisent les règles
   * de blocage : « attend ma relecture » vise revue_a_faire, « dort sur
   * recette » vise recette. Renommez les libellés, changez les couleurs — mais
   * retirer une clé prive la règle correspondante de son objet.
   *
   * `hints` sert à deviner, au premier passage, à quelle colonne rattacher un
   * statut inconnu. Le fragment le plus long l'emporte : « revue ok » gagne
   * contre « revue ». Tout se corrige ensuite dans /parametres.
   */
  columns: [
    {
      key: 'nouveau',
      label: 'Nouveau',
      hints: ['nouveau', 'new', 'a trier', 'to triage', 'ouvert'],
      color: '#e16b16',
    },
    {
      key: 'a_faire',
      label: 'À faire',
      hints: ['a faire', 'to do', 'todo', 'ready', 'pret', 'planifie', 'open'],
      color: '#87909e',
    },
    {
      key: 'dev_en_cours',
      label: 'En cours',
      hints: ['en cours', 'in progress', 'doing', 'wip', 'developpement'],
      color: '#5f55ee',
    },
    {
      key: 'revue_a_faire',
      label: 'Revue à faire',
      hints: ['revue', 'review', 'relecture', 'merge request', 'pull request'],
      color: '#aa8d80',
    },
    {
      key: 'revue_ok',
      label: 'Revue OK',
      hints: ['revue ok', 'revue de code ok', 'review ok', 'reviewed', 'approuve', 'approved'],
      color: '#3db88b',
    },
    {
      key: 'recette',
      label: 'Recette',
      hints: ['recette', 'staging', 'preprod', 'qa', 'uat', 'a tester', 'to test'],
      color: '#f8ae00',
    },
  ],

  enrich: {
    comments: true,
    commentsPerTask: 2,
    maxTasks: 40,
    scope: ['mine', 'revue_a_faire'],
  },
  bugs: {
    taskTypes: ['Bug'],
    listNameContains: ['bug'],
    tags: ['bug'],
    namePrefixes: ['bug'],
  },
  staleAfterDays: 14,
  blockers: {
    reviewWaitDays: 2,
    recetteWaitDays: 7,
    maxItems: 12,
  },
  temps: {
    enabled: true,
    lookbackDays: 90,
    targetHoursPerDay: 7,
    weekDays: [0, 1, 2, 3, 4],
  },
  /*
   * Dépôts git locaux à rapprocher des tickets par la référence dans le nom de
   * branche. Vide par défaut : personne d'autre n'a vos chemins. Un dépôt
   * introuvable est ignoré sans bruit, la section disparaît alors des cartes.
   */
  git: {
    enabled: true,
    repos: [] as string[],
    maxBranchesPerTask: 4,
  },
  mentions: {
    enabled: true,
    lookbackDays: 14,
    scanMaxTasks: 60,
  },
  ignoredCustomFieldsPrefix: ['BASELINE_'],
  report: {
    notify: true,
    keepDays: 30,
    descriptionExcerptChars: 400,
  },
  veille: {
    enabled: true,
    maxAgeDays: 10,
    perSource: 5,
    maxItems: 80,
    timeoutSeconds: 10,
    cacheHours: 6,
    excludeTitle: ['alpha', 'beta', '-rc', 'canary', 'nightly', 'next.'],
    highlight: [
      'Laravel 1*',
      'PHP 8*',
      'PHP 9*',
      'Vue 3*',
      'Element Plus',
      'Vite',
      'Pinia',
      'Sequelize',
      'Express',
      'Node.js 2*',
      'MySQL',
      'Claude',
      'Anthropic',
      'MCP',
      'Claude Code',
      'sécurité',
      'security',
      'CVE',
      'vulnérab*',
      'vulnerab*',
      'breaking',
      'deprecat*',
      'Docker',
      'ClickUp',
    ],
    groups: [
      {
        key: 'ia',
        label: 'IA & agents',
      },
      {
        key: 'laravel',
        label: 'Laravel & PHP',
      },
      {
        key: 'front',
        label: 'Vue & front',
      },
      {
        key: 'node',
        label: 'Node & back',
      },
      {
        key: 'outils',
        label: 'Outils & écosystème',
      },
    ],
    sources: [
      {
        label: 'Claude Code (releases)',
        group: 'ia',
        url: 'https://github.com/anthropics/claude-code/releases.atom',
      },
      {
        label: 'Simon Willison',
        group: 'ia',
        url: 'https://simonwillison.net/atom/everything/',
      },
      {
        label: 'Hacker News · IA (150+ pts)',
        group: 'ia',
        url: 'https://hnrss.org/newest?q=Claude+OR+LLM+OR+%22AI+agent%22&points=150',
      },
      {
        label: 'Latent Space',
        group: 'ia',
        url: 'https://www.latent.space/feed',
      },
      {
        label: 'OpenAI',
        group: 'ia',
        url: 'https://openai.com/news/rss.xml',
      },
      {
        label: 'Google AI',
        group: 'ia',
        url: 'https://blog.google/technology/ai/rss/',
      },
      {
        label: 'Laravel News',
        group: 'laravel',
        url: 'https://laravel-news.com/feed',
      },
      {
        label: 'Laravel blog',
        group: 'laravel',
        url: 'https://blog.laravel.com/feed',
      },
      {
        label: 'laravel/framework (releases)',
        group: 'laravel',
        url: 'https://github.com/laravel/framework/releases.atom',
      },
      {
        label: 'PHP.net',
        group: 'laravel',
        url: 'https://www.php.net/feed.atom',
      },
      {
        label: 'Freek Van der Herten',
        group: 'laravel',
        url: 'https://freek.dev/feed',
      },
      {
        label: 'stitcher.io',
        group: 'laravel',
        url: 'https://stitcher.io/rss',
      },
      {
        label: 'Laravel Daily',
        group: 'laravel',
        url: 'https://laraveldaily.com/feed',
      },
      {
        label: 'Vue.js blog',
        group: 'front',
        url: 'https://blog.vuejs.org/feed.rss',
      },
      {
        label: 'vuejs/core (releases)',
        group: 'front',
        url: 'https://github.com/vuejs/core/releases.atom',
      },
      {
        label: 'Element Plus (releases)',
        group: 'front',
        url: 'https://github.com/element-plus/element-plus/releases.atom',
      },
      {
        label: 'Vite (releases)',
        group: 'front',
        url: 'https://github.com/vitejs/vite/releases.atom',
      },
      {
        label: 'Node.js blog',
        group: 'node',
        url: 'https://nodejs.org/en/feed/blog.xml',
      },
      {
        label: 'Sequelize (releases)',
        group: 'node',
        url: 'https://github.com/sequelize/sequelize/releases.atom',
      },
      {
        label: 'Express (releases)',
        group: 'node',
        url: 'https://github.com/expressjs/express/releases.atom',
      },
      {
        label: 'Docker blog',
        group: 'outils',
        url: 'https://www.docker.com/blog/feed/',
      },
      {
        label: 'GitHub changelog',
        group: 'outils',
        url: 'https://github.blog/changelog/feed/',
      },
    ],
  },
} satisfies ClickUpDailyConfig

export default clickUpDailyConfig
