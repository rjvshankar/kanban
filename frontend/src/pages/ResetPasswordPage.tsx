import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { api } from '../api/client'
import { Field, FormCard, FormError } from './Form'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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

  if (!token) {
    return (
      <FormCard title="Reset password">
        <p>This reset link is missing its token. <Link to="/forgot-password">Request a new one</Link>.</p>
      </FormCard>
    )
  }

  return (
    <FormCard title="Choose a new password">
      <form onSubmit={onSubmit}>
        <Field label="New password (min 8 characters)" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <FormError message={error} />
        <button type="submit" disabled={busy}>{busy ? 'Saving...' : 'Reset password'}</button>
      </form>
    </FormCard>
  )
}
