// Pure helpers for the light/dark choice: the preference lives in a plain cookie (not httpOnly, JS must read it).
// The inline script in index.html repeats the read logic so the page never flashes the wrong theme.

export type Theme = 'light' | 'dark'

export const THEME_COOKIE = 'kanban_theme'
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

// The saved choice, or null if the user never picked one.
export function readThemeCookie(): Theme | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=(light|dark)(?:;|$)`))
  return match ? (match[1] as Theme) : null
}

// Remembers the choice for a year, on all paths of this site.
export function writeThemeCookie(theme: Theme) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${THEME_COOKIE}=${theme}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`
}

// The OS setting.
export function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// Toggles the "dark" class that the theme in index.css keys off.
export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}
