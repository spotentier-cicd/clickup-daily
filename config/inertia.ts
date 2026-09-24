import { defineConfig } from '@adonisjs/inertia'

const inertiaConfig = defineConfig({
  /*
   * Rendu serveur désactivé (défaut du kit).
   *
   * L'activer ponctuellement est en revanche le meilleur test de fumée qu'on
   * ait : une erreur de rendu devient un 500 avec sa pile au lieu d'une page
   * blanche silencieuse. C'est comme ça qu'a été trouvé le plantage sur les
   * archives antérieures à l'ajout de `thresholds` au contrat.
   *
   * On ne le laisse pas actif en permanence parce que readTab() et readTheme()
   * lisent localStorage à l'initialisation de l'état : le serveur rendrait
   * l'onglet « Aujourd'hui » alors que le navigateur sait qu'on était sur
   * « Tempo », et l'hydratation divergerait.
   */
  ssr: {
    /**
     * Toggle SSR mode for Inertia pages.
     */
    enabled: false,

    /**
     * Entry file used by the SSR server build.
     */
    entrypoint: 'inertia/ssr.tsx',
  },
})

export default inertiaConfig
