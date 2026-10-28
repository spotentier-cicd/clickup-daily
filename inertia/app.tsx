import './css/app.css'
import { type ReactElement } from 'react'
import { client } from './client'
import Layout from '~/layouts/default'
import { type Data } from '@generated/data'
import { createRoot } from 'react-dom/client'
import { createInertiaApp, type ResolvedComponent } from '@inertiajs/react'
import { TuyauProvider } from '@adonisjs/inertia/react'
import { resolvePageComponent } from '@adonisjs/inertia/helpers'

const appName = import.meta.env.VITE_APP_NAME || 'Point ClickUp'

createInertiaApp({
  title: (title) => (title ? `${title} - ${appName}` : appName),
  resolve: (name) => {
    return resolvePageComponent<ResolvedComponent>(
      `./pages/${name}.tsx`,
      import.meta.glob<ResolvedComponent>('./pages/**/*.tsx'),
      (page: ReactElement<Data.SharedProps>) => <Layout children={page} />
    )
  },
  setup({ el, App, props }) {
    createRoot(el).render(
      <TuyauProvider client={client}>
        <App {...props} />
      </TuyauProvider>
    )
  },
  progress: {
    color: '#4a54b8',
  },
})

/*
| L'APPLICATION INSTALLÉE.
|
| Le travailleur de service est ce qui fait passer la page du statut de
| « site » à celui d'« application » : une fenêtre à elle, une icône dans le
| dock, et une page honnête quand le serveur ne répond plus. Ce qu'il met en
| cache, et surtout ce qu'il refuse d'y mettre, est expliqué dans public/sw.js.
|
| Il ne s'enregistre qu'en PRODUCTION. En développement, Vite sert les modules
| depuis sa propre mémoire : un intermédiaire qui met des fichiers en cache
| n'aurait là que des inconvénients. C'est sans conséquence pour l'usage réel,
| le conteneur tournant en NODE_ENV=production.
*/
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  globalThis.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* Origine non sécurisée, stockage refusé : le tableau marche sans. */
    })
  })
}
