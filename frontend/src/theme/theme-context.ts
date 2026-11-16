// Defines the theme context object and the useTheme hook.
// The provider component lives in ThemeProvider.tsx (separate file for React Fast Refresh).

import { createContext, useContext } from 'react'
import type { Theme } from './theme'

export interface ThemeContextValue {
  // The theme currently shown.
  theme: Theme
  // Picks a theme and remembers it in a cookie.
  setTheme: (theme: Theme) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

// Hook to read or change the theme; throws if used outside ThemeProvider.
export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
