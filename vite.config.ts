import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import adonisjs from '@adonisjs/vite/client'

export default defineConfig({
  /*
   * Cache de pré-bundling séparé pour les tests.
   *
   * `node ace test` démarre l'application, donc Vite, sur le même projet qu'un
   * `npm run dev` déjà en cours. Les deux instances se disputaient alors
   * node_modules/.vite : la suite de tests reconstruisait les dépendances
   * optimisées, le serveur de développement perdait les siennes, et le
   * navigateur recevait « 504 Outdated Optimize Dep » sur chaque import — donc
   * une page entièrement vide, jusqu'à un redémarrage.
   */
  cacheDir: process.env.NODE_ENV === 'test' ? 'node_modules/.vite-test' : 'node_modules/.vite',

  plugins: [
    tailwindcss(),
    react(),
    adonisjs({ entryPoints: ['inertia/app.tsx'], reload: ['resources/views/**/*.edge'] }),
  ],

  /**
   * Define aliases for importing modules from
   * your frontend code
   */
  resolve: {
    alias: {
      '~/': `${import.meta.dirname}/inertia/`,
      '@generated': `${import.meta.dirname}/.adonisjs/client/`,
      /* Le domaine est pur : le navigateur partage le même code que le serveur. */
      '#domain': `${import.meta.dirname}/app/domain`,
      '@': `${import.meta.dirname}/inertia`,
    },
  },

  server: {
    watch: {
      ignored: ['**/storage/**', '**/tmp/**'],
    },
  },
})
