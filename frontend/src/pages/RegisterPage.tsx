import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../auth/auth-context'
import { Field, FormCard, FormError } from './Form'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phoneNumber: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

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
      <form onSubmit={onSubmit}>
        <Field label="First name" required maxLength={100} autoComplete="given-name" value={form.firstName} onChange={set('firstName')} />
        <Field label="Last name" required maxLength={100} autoComplete="family-name" value={form.lastName} onChange={set('lastName')} />
        <Field label="Email" type="email" required autoComplete="email" value={form.email} onChange={set('email')} />
        <Field label="Phone (optional)" type="tel" maxLength={30} autoComplete="tel" value={form.phoneNumber} onChange={set('phoneNumber')} />
        <Field label="Password (min 8 characters)" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={form.password} onChange={set('password')} />
        <FormError message={error} />
        <button type="submit" disabled={busy}>{busy ? 'Creating...' : 'Create account'}</button>
      </form>
      <p>Already registered? <Link to="/login">Log in</Link></p>
    </FormCard>
  )
}
