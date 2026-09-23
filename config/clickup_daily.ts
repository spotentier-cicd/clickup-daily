import type { ClickUpDailyConfig } from '#domain/config/types'

/*
| Configuration de clickup-daily.
|
| Porté depuis le config.json de la v1. Le « satisfies » garde l'autocomplétion
| et fait échouer le typecheck sur une clé inconnue ou mal typée ; les règles que
| les types ne savent pas exprimer (un statut sans colonne, une source de veille
| dans un groupe inexistant) sont vérifiées au démarrage par checkConfigInvariants.
*/
const clickUpDailyConfig = {
  workspaceId: '9015220362',
  timezone: 'Europe/Paris',
  meUserId: 106607105,
  environments: [
    {
      key: 'ROC',
      label: 'ROC',
      spaceId: '90152348891',
      statuses: [
        'nouveau',
        'a faire',
        'dev en cours',
        'revue de code a faire',
        'revue ok',
        'deployé sur recette',
      ],
    },
    {
      key: 'ROCND',
      label: 'ROC New Deal',
      spaceId: '901510389524',
      statuses: [
        'nouveau',
        'a faire',
        'dev en cours',
        'revue de code a faire',
        'revue ok',
        'deployé sur recette',
      ],
    },
    {
      key: 'TEMPO',
      label: 'Tempo',
      spaceId: '90152862404',
      statuses: [
        'nouveau',
        'a faire',
        'dev en cours',
        'revue de code a faire',
        'revue de code ok',
        'deployé sur recette',
      ],
    },
  ],
  columns: [
    {
      key: 'nouveau',
      label: 'Nouveau',
      match: ['nouveau'],
      color: '#e16b16',
    },
    {
      key: 'a_faire',
      label: 'À faire',
      match: ['a faire'],
      color: '#87909e',
    },
    {
      key: 'dev_en_cours',
      label: 'Dev en cours',
      match: ['dev en cours'],
      color: '#5f55ee',
    },
    {
      key: 'revue_a_faire',
      label: 'Revue de code à faire',
      match: ['revue de code a faire'],
      color: '#aa8d80',
    },
    {
      key: 'revue_ok',
      label: 'Revue code OK',
      match: ['revue ok', 'revue de code ok'],
      color: '#3db88b',
    },
    {
      key: 'recette',
      label: 'Déployé sur recette',
      match: ['deploye sur recette'],
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
  backlog: {
    statuses: ['nouveau'],
    folderNameContains: ['backlog'],
    listNameContains: [],
    keepMine: true,
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
  git: {
    enabled: true,
    repos: [
      '~/Documents/projects/roc/api',
      '~/Documents/projects/roc/front',
      '~/Documents/projects/newdeal/api',
      '~/Documents/projects/newdeal/front',
      '~/Documents/projects/tempo/api_tempo',
      '~/Documents/projects/tempo/front',
      '~/Documents/projects/dashboard_tempo',
    ],
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
