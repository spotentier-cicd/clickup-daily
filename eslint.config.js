import { configApp } from '@adonisjs/eslint-config'
import { react } from '@adonisjs/eslint-config/react'

export default configApp(...react, {
  /*
   * inertia/components/ui est du code livré par la CLI shadcn, qui le réécrit
   * à chaque « shadcn add ». Renommer ces fichiers en snake_case les ferait
   * diverger de l'outil qui les régénère, donc on n'applique pas la règle ici.
   */
  files: ['inertia/components/ui/**'],
  rules: { '@unicorn/filename-case': 'off' },
})
