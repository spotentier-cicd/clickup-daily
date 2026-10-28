export type Theme = 'auto' | 'light' | 'dark'

/*
| Trois états, et un seul porteur : l'attribut data-theme sur <html>.
|
| « auto » ne pose PAS d'attribut — c'est l'absence qui laisse la main à
| prefers-color-scheme. Poser data-theme="auto" figerait la page sur la
| définition sombre de base, puisque le sélecteur clair est
| :root:not([data-theme]).
*/
const KEY = 'cud-theme'

export const THEMES: Theme[] = ['auto', 'light', 'dark']

export const THEME_LABEL: Record<Theme, string> = {
  auto: 'Thème : automatique',
  light: 'Thème : clair',
  dark: 'Thème : sombre',
}

/* Le libellé du sélecteur à trois positions du menu du compte. */
export const THEME_SHORT: Record<Theme, string> = {
  auto: 'Auto',
  light: 'Clair',
  dark: 'Sombre',
}

export function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'auto') return stored
  } catch {
    /* Navigation privée, stockage bloqué : le thème auto fera l'affaire. */
  }
  return 'auto'
}

/** Le thème suivant dans le cycle auto → clair → sombre → auto. */
export function nextTheme(theme: Theme): Theme {
  return THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]
}

/** Applique le thème et le mémorise. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement

  if (theme === 'auto') root.removeAttribute('data-theme')
  else root.dataset.theme = theme

  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* Le thème ne survivra pas au rechargement, ce n'est pas grave. */
  }

  syncThemeColor()
}

/**
 * La couleur annoncée au système, remise en accord avec la barre.
 *
 * En fenêtre autonome — l'application installée — c'est elle qui peint le
 * cadre autour de la page. Si elle ne suit pas le thème, la barre bleu nuit
 * se retrouve sertie dans la teinte de l'autre thème.
 *
 * Elle est LUE dans la feuille de style plutôt que recopiée ici : les deux
 * bleus nuit n'existent qu'à un endroit, le jeton --color-nav. Tant que la
 * feuille n'est pas là, la valeur du gabarit tient.
 */
export function syncThemeColor(): void {
  const nav = getComputedStyle(document.documentElement).getPropertyValue('--color-nav').trim()
  if (!nav) return

  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', nav)
}
