/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| Les routes de l'application. Elle tourne en local sur 127.0.0.1 pour un
| seul utilisateur : aucune authentification.
|
*/

import router from '@adonisjs/core/services/router'

router.on('/').renderInertia('home', {}).as('home')
