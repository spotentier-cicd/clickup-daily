/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
|
| L'application tourne en local sur 127.0.0.1 pour un seul utilisateur :
| aucune authentification.
|
*/

import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router.get('/', [controllers.Dashboard, 'index']).as('dashboard')
router.get('/r/:day', [controllers.Dashboard, 'show']).as('dashboard.archive')

/* Relance une collecte. Inertia pose le jeton XSRF, Shield le vérifie. */
router.post('/refresh', [controllers.Refresh, 'store']).as('refresh')

/* Choix des projets affichés. */
router.put('/preferences/projects', [controllers.Preferences, 'update']).as('preferences.projects')
