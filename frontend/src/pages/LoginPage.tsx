// Login form. After a successful login it returns you to the page you were trying to reach (or "/").

import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../auth/auth-context'
import { Field, FormCard, FormError } from './Form'

// Login screen.
export default function LoginPage() {
  // Auth action from context.
  const { login } = useAuth()
  // Programmatic navigation after login.
  const navigate = useNavigate()
  // Current location; its state may carry data from the previous page.
  const location = useLocation()
  // Optional data passed here by other pages: where to return to, or a "registered"/"reset" success flag.
  const state = location.state as { from?: string; registered?: boolean; reset?: boolean } | null

  // Form field: email.
  const [email, setEmail] = useState('')
  // Form field: password.
  const [password, setPassword] = useState('')
  // Error message to show, or null.
  const [error, setError] = useState<string | null>(null)
  // True while the request is running, to disable the button.
  const [busy, setBusy] = useState(false)

  // Submits credentials and redirects on success; shows the API's error otherwise.
  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await login(email, password)
      navigate(state?.from ?? '/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.')
      setBusy(false)
    }
  }

  return (
    <FormCard title="Log in">
      {state?.registered && <p>Account created. Please log in.</p>}
      {state?.reset && <p>Password updated. Please log in.</p>}
      <form onSubmit={onSubmit}>
        <Field label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <FormError message={error} />
        <button type="submit" disabled={busy}>{busy ? 'Logging in...' : 'Log in'}</button>
      </form>
      <p><Link to="/forgot-password">Forgot password?</Link></p>
      <p>No account? <Link to="/register">Register</Link></p>
    </FormCard>
  )
}
