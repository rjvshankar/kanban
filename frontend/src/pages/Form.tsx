import type { ReactNode } from 'react'

export function FormCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main style={{ maxWidth: 380, margin: '10vh auto', padding: '0 1rem' }}>
      <h1>{title}</h1>
      {children}
    </main>
  )
}

export function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...input } = props
  return (
    <label style={{ display: 'block', marginBottom: '0.75rem' }}>
      {label}
      <input {...input} style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '0.4rem' }} />
    </label>
  )
}

export function FormError({ message }: { message: string | null }) {
  return message ? <p role="alert" style={{ color: 'crimson' }}>{message}</p> : null
}
