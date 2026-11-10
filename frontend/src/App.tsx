// Root component: wraps the app in the router and auth provider and declares every route.
// Guest-only pages, the password-reset page and the logged-in pages are grouped by route guard.

import { BrowserRouter, Route, Routes } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from './auth/AuthProvider'
import { GuestRoute, ProtectedRoute } from './auth/ProtectedRoute'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import BoardListPage from './pages/BoardListPage'
import BoardPage from './pages/BoardPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ResetPasswordPage from './pages/ResetPasswordPage'

// Renders the router, the auth provider and the route table.
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Only for logged-out users; logged-in users are redirected to "/". */}
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          </Route>
          {/* Reset link is opened from an email, so it works whether or not you're logged in. */}
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          {/* Only for logged-in users; logged-out users are redirected to /login. */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<BoardListPage />} />
            <Route path="/boards/:id" element={<BoardPage />} />
          </Route>
        </Routes>
        {/* Container that shows toast notifications (used for errors on the board pages). */}
        <Toaster position="bottom-right" />
      </AuthProvider>
    </BrowserRouter>
  )
}
