import { configApp } from '@adonisjs/eslint-config'
import { react } from '@adonisjs/eslint-config/react'

export default configApp(
  ...react,
  {
    /*
     * inertia/components/ui est du code livré par la CLI shadcn, qui le réécrit
     * à chaque « shadcn add ». Renommer ces fichiers en snake_case les ferait
     * diverger de l'outil qui les régénère, donc on n'applique pas la règle ici.
     */
    files: ['inertia/components/ui/**'],
    rules: { '@unicorn/filename-case': 'off' },
  },
  {
    /*
     * app/domain est pur par construction : aucune I/O, aucun import d'AdonisJS,
     * de Lucid ou de node:*. C'est ce qui permet au navigateur d'utiliser
     * exactement le même code que le serveur — une seule définition de « cette
     * tâche est-elle visible », pas deux qui divergeront.
     *
     * L'exemption n'est pas une parole d'honneur : tests/unit/domain_purity.spec.ts
     * relit tout le dossier et échoue si un import serveur s'y glisse.
     */
    files: ['inertia/**'],
    rules: {
      '@adonisjs/no-backend-import-in-frontend': ['error', { allowed: ['#domain/*', '#domain/**'] }],
    },
  }
)
