// Small shared building blocks for the auth forms: a centered card, a labeled input and an error line.

import type { ReactNode } from 'react'

// Centered page container with a title.
export function FormCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main style={{ maxWidth: 380, margin: '10vh auto', padding: '0 1rem' }}>
      <h1>{title}</h1>
      {children}
    </main>
  )
}

// A labeled text input; accepts any normal <input> props.
export function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  // Split the label text from the props that belong on the <input>.
  const { label, ...input } = props
  return (
    <label style={{ display: 'block', marginBottom: '0.75rem' }}>
      {label}
      <input {...input} style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '0.4rem' }} />
    </label>
  )
}

// Shows an error message, or nothing when message is null.
export function FormError({ message }: { message: string | null }) {
  return message ? <p role="alert" style={{ color: 'crimson' }}>{message}</p> : null
}
