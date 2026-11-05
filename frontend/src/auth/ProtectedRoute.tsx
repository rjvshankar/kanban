import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './auth-context'

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <p>Loading...</p>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

// Keeps logged-in users away from /login, /register, etc.
export function GuestRoute() {
  const { user, loading } = useAuth()

  if (loading) return <p>Loading...</p>
  if (user) return <Navigate to="/" replace />
  return <Outlet />
}
