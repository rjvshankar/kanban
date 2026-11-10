// Route guards: ProtectedRoute for logged-in-only pages, GuestRoute for login/register pages.

import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './auth-context'

// Renders the nested route if logged in; otherwise redirects to /login and remembers where you were going.
export function ProtectedRoute() {
  // Current user plus whether the initial session check is still running.
  const { user, loading } = useAuth()
  // Current URL, passed to /login so we can return here after login.
  const location = useLocation()

  // Wait for the session check so a logged-in user isn't bounced to /login on refresh.
  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading...</p>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

// Keeps logged-in users away from /login, /register, etc.
export function GuestRoute() {
  const { user, loading } = useAuth()

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading...</p>
  if (user) return <Navigate to="/" replace />
  return <Outlet />
}
