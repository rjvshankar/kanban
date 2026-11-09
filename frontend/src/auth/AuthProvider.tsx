// Holds the logged-in user in state and provides login / register / logout to the app.
// The session itself is an httpOnly cookie, so on page load we ask the API who we are.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, setUnauthorizedHandler } from '../api/client'
import { AuthContext, type AuthContextValue, type RegisterInput, type User } from './auth-context'

// Wrap the app in this so useAuth() works anywhere below it.
export function AuthProvider({ children }: { children: ReactNode }) {
  // The logged-in user, or null when logged out.
  const [user, setUser] = useState<User | null>(null)
  // True until the initial /auth/me check completes.
  const [loading, setLoading] = useState(true)

  // On page load, ask the API who we are (the cookie is httpOnly, so JS can't check it directly).
  useEffect(() => {
    // Set by cleanup so a late response doesn't update state after unmount.
    let cancelled = false
    api
      .get<User>('/auth/me')
      .then((u) => !cancelled && setUser(u))
      .catch(() => !cancelled && setUser(null))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    // Any 401 from the API logs the user out locally, so route guards redirect to /login.
    setUnauthorizedHandler(() => setUser(null))
    return () => setUnauthorizedHandler(null)
  }, [])

  // Logs in; the API sets the cookie and returns the user.
  const login = useCallback(async (email: string, password: string) => {
    setUser(await api.post<User>('/auth/login', { email, password }))
  }, [])

  // Register does not log in; the API only creates the account.
  // Creates an account (does not log in).
  const register = useCallback(async (input: RegisterInput) => {
    await api.post('/auth/register', input)
  }, [])

  // Clears the cookie via the API, then clears local state even if that request fails.
  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } finally {
      setUser(null)
    }
  }, [])

  // Memoized so consumers only re-render when something they use actually changes.
  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
