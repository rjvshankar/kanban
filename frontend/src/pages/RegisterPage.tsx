// Registration form. On success it sends you to /login with a "account created" message.

import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { useAuth } from '../auth/auth-context'
import { Field, FormCard, FormError } from './Form'

// Registration screen.
export default function RegisterPage() {
  // Auth action from context.
  const { register } = useAuth()
  // Programmatic navigation after registering.
  const navigate = useNavigate()

  // All form fields in one object.
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phoneNumber: '', password: '' })
  // Error message to show, or null.
  const [error, setError] = useState<string | null>(null)
  // True while the request is running, to disable the button.
  const [busy, setBusy] = useState(false)

  // Returns an onChange handler that updates a single field of the form.
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  // Submits the form; an empty phone number is sent as undefined.
  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await register({ ...form, phoneNumber: form.phoneNumber.trim() || undefined })
      navigate('/login', { replace: true, state: { registered: true } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.')
      setBusy(false)
    }
  }

  return (
    <FormCard title="Register">
      <form onSubmit={onSubmit} className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" required maxLength={100} autoComplete="given-name" value={form.firstName} onChange={set('firstName')} />
          <Field label="Last name" required maxLength={100} autoComplete="family-name" value={form.lastName} onChange={set('lastName')} />
        </div>
        <Field label="Email" type="email" required autoComplete="email" value={form.email} onChange={set('email')} />
        <Field label="Phone (optional)" type="tel" maxLength={30} autoComplete="tel" value={form.phoneNumber} onChange={set('phoneNumber')} />
        <Field label="Password (min 8 characters)" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={form.password} onChange={set('password')} />
        <FormError message={error} />
        <Button type="submit" disabled={busy}>{busy ? 'Creating...' : 'Create account'}</Button>
      </form>
      <p className="text-sm text-muted-foreground">Already registered? <Link to="/login" className="text-foreground underline-offset-4 hover:underline">Log in</Link></p>
    </FormCard>
  )
}
