import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { api } from '../api/client'
import { Field, FormCard, FormError } from './Form'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <FormCard title="Forgot password">
      {sent ? (
        <p>If that email is registered, a reset link has been sent.</p>
      ) : (
        <form onSubmit={onSubmit}>
          <Field label="Email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <FormError message={error} />
          <button type="submit" disabled={busy}>{busy ? 'Sending...' : 'Send reset link'}</button>
        </form>
      )}
      <p><Link to="/login">Back to log in</Link></p>
    </FormCard>
  )
}
