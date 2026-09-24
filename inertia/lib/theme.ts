export type Theme = 'auto' | 'light' | 'dark'

const KEY = 'cud-theme'

export function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'auto') return stored
  } catch {
    /* Navigation privée, stockage bloqué : le thème auto fera l'affaire. */
  }
  return 'auto'
}

/** Applique le thème et le mémorise. « auto » suit le réglage du système. */
export function applyTheme(theme: Theme): void {
  const dark =
    theme === 'dark' ||
    (theme === 'auto' && globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches)

  document.documentElement.classList.toggle('dark', Boolean(dark))

  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* Le thème ne survivra pas au rechargement, ce n'est pas grave. */
  }
}
