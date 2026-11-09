// Defines the auth context object, its types and the useAuth hook.
// The provider component lives in AuthProvider.tsx (separate file for React Fast Refresh).

import { createContext, useContext } from 'react'

// The logged-in user as returned by /auth/login and /auth/me.
export interface User {
  id: number
  email: string
  firstName: string
  lastName: string
}

// Fields submitted by the registration form.
export interface RegisterInput {
  firstName: string
  lastName: string
  email: string
  phoneNumber?: string
  password: string
}

// Everything components can read or call via useAuth().
export interface AuthContextValue {
  user: User | null
  // Stays true until the first /auth/me check finishes, so guards don't redirect too early.
  loading: boolean // true until the initial /auth/me check finishes
  login: (email: string, password: string) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  logout: () => Promise<void>
}

// The React context; null until AuthProvider supplies a value.
export const AuthContext = createContext<AuthContextValue | null>(null)

// Hook to access auth state and actions; throws if used outside AuthProvider.
export function useAuth() {
  // The current context value (null if there is no provider).
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
