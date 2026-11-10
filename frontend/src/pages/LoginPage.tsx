// Login form. After a successful login it returns you to the page you were trying to reach (or "/").

import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
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
      {state?.registered && <p className="text-sm text-muted-foreground">Account created. Please log in.</p>}
      {state?.reset && <p className="text-sm text-muted-foreground">Password updated. Please log in.</p>}
      <form onSubmit={onSubmit} className="grid gap-4">
        <Field label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <FormError message={error} />
        <Button type="submit" disabled={busy}>{busy ? 'Logging in...' : 'Log in'}</Button>
      </form>
      <div className="grid gap-1 text-sm text-muted-foreground">
        <Link to="/forgot-password" className="underline-offset-4 hover:text-foreground hover:underline">Forgot password?</Link>
        <p>No account? <Link to="/register" className="text-foreground underline-offset-4 hover:underline">Register</Link></p>
      </div>
    </FormCard>
  )
}
