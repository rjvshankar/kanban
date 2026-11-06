import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { api } from '../api/client'
import type { BoardSummary } from '../api/types'
import { useAuth } from '../auth/auth-context'
import { FormError } from './Form'

export default function BoardListPage() {
  const { user, logout } = useAuth()
  const [boards, setBoards] = useState<BoardSummary[] | null>(null)
  const [version, setVersion] = useState(0)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .get<BoardSummary[]>('/boards')
      .then((b) => !cancelled && setBoards(b))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Failed to load boards.'))
    return () => {
      cancelled = true
    }
  }, [version])

  const reload = () => setVersion((v) => v + 1)

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await api.post('/boards', { name })
      setName('')
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create board.')
    }
  }

  async function onDelete(b: BoardSummary) {
    if (!confirm(`Delete board "${b.name}"?`)) return
    setError(null)
    try {
      await api.delete(`/boards/${b.id}`)
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete board.')
    }
  }

  return (
    <main style={{ maxWidth: 600, margin: '5vh auto', padding: '0 1rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Your boards</h1>
        <span>
          {user?.firstName} <button onClick={() => void logout()}>Log out</button>
        </span>
      </header>

      <form onSubmit={onCreate} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input placeholder="New board name" required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1, padding: '0.4rem' }} />
        <button type="submit">Create</button>
      </form>
      <FormError message={error} />

      {boards === null ? (
        <p>Loading...</p>
      ) : boards.length === 0 ? (
        <p>No boards yet. Create one above.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {boards.map((b) => (
            <li key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
              <Link to={`/boards/${b.id}`}>{b.name}</Link>
              <span>
                <small>{b.role}</small>{' '}
                {b.role === 'owner' && <button onClick={() => void onDelete(b)}>Delete</button>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
