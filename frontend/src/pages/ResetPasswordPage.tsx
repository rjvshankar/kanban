// Reset-password form, opened from the emailed link (/reset-password?token=...).

import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { api } from '../api/client'
import { Field, FormCard, FormError } from './Form'

// Reset-password screen.
export default function ResetPasswordPage() {
  // The URL query string.
  const [params] = useSearchParams()
  // The one-time reset token from the emailed link; null if the link is malformed.
  const token = params.get('token')
  // Programmatic navigation after resetting.
  const navigate = useNavigate()

  // Form field: the new password.
  const [password, setPassword] = useState('')
  // Error message to show, or null (e.g. expired link).
  const [error, setError] = useState<string | null>(null)
  // True while the request is running, to disable the button.
  const [busy, setBusy] = useState(false)

  // Sends the token and new password; on success goes to /login.
  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await api.post('/auth/reset-password', { token, newPassword: password })
      navigate('/login', { replace: true, state: { reset: true } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed.')
      setBusy(false)
    }
  }

  // No token in the URL: nothing to reset, so point to the request page.
  if (!token) {
    return (
      <FormCard title="Reset password">
        <p className="text-sm text-muted-foreground">
          This reset link is missing its token.{' '}
          <Link to="/forgot-password" className="text-foreground underline-offset-4 hover:underline">Request a new one</Link>.
        </p>
      </FormCard>
    )
  }

  return (
    <FormCard title="Choose a new password">
      <form onSubmit={onSubmit} className="grid gap-4">
        <Field label="New password (min 8 characters)" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <FormError message={error} />
        <Button type="submit" disabled={busy}>{busy ? 'Saving...' : 'Reset password'}</Button>
      </form>
    </FormCard>
  )
}
