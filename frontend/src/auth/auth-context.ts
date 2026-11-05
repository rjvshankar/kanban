import { createContext, useContext } from 'react'

export interface User {
  id: number
  email: string
  firstName: string
  lastName: string
}

export interface RegisterInput {
  firstName: string
  lastName: string
  email: string
  phoneNumber?: string
  password: string
}

export interface AuthContextValue {
  user: User | null
  loading: boolean // true until the initial /auth/me check finishes
  login: (email: string, password: string) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
