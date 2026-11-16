// Holds the light/dark theme in state, applies it to <html> and remembers an explicit choice in a cookie.
// Until the user picks, the theme follows the OS setting live.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { applyTheme, readThemeCookie, systemTheme, writeThemeCookie, type Theme } from './theme'
import { ThemeContext } from './theme-context'

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Saved choice if any, otherwise the OS setting.
  const [theme, setThemeState] = useState<Theme>(() => readThemeCookie() ?? systemTheme())

  useEffect(() => applyTheme(theme), [theme])

  // No saved choice: keep following the OS when it flips.
  useEffect(() => {
    if (readThemeCookie()) return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (!readThemeCookie()) setThemeState(systemTheme())
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    writeThemeCookie(next)
    setThemeState(next)
  }, [])

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
