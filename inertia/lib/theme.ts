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
}
