// Forgot-password form: asks the API to email a reset link.
// The API replies the same way whether or not the email exists, and so does this page.

import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { api } from '../api/client'
import { Field, FormCard, FormError } from './Form'

// Forgot-password screen.
export default function ForgotPasswordPage() {
  // Form field: email.
  const [email, setEmail] = useState('')
  // Error message to show, or null (e.g. rate-limited).
  const [error, setError] = useState<string | null>(null)
  // True once the request succeeded; swaps the form for a confirmation message.
  const [sent, setSent] = useState(false)
  // True while the request is running, to disable the button.
  const [busy, setBusy] = useState(false)

  // Requests the reset email.
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
        <p className="text-sm text-muted-foreground">If that email is registered, a reset link has been sent.</p>
      ) : (
        <form onSubmit={onSubmit} className="grid gap-4">
          <Field label="Email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <FormError message={error} />
          <Button type="submit" disabled={busy}>{busy ? 'Sending...' : 'Send reset link'}</Button>
        </form>
      )}
      <Link to="/login" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Back to log in</Link>
    </FormCard>
  )
}
