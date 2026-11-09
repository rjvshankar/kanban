// Home page: lists the boards you belong to, with create and delete (owner only).

import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { api } from '../api/client'
import type { BoardSummary } from '../api/types'
import { useAuth } from '../auth/auth-context'
import { FormError } from './Form'

// Board list screen.
export default function BoardListPage() {
  // Current user (for the greeting) and the logout action.
  const { user, logout } = useAuth()
  // The board list; null until the first load finishes.
  const [boards, setBoards] = useState<BoardSummary[] | null>(null)
  // Bumping this re-runs the load effect, which is how we refetch.
  const [version, setVersion] = useState(0)
  // Form field: name of the board to create.
  const [name, setName] = useState('')
  // Error message to show, or null.
  const [error, setError] = useState<string | null>(null)

  // Loads the board list on mount and whenever version changes.
  useEffect(() => {
    // Set by cleanup so a late response is ignored after unmount.
    let cancelled = false
    api
      .get<BoardSummary[]>('/boards')
      .then((b) => !cancelled && setBoards(b))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Failed to load boards.'))
    return () => {
      cancelled = true
    }
  }, [version])

  // Triggers a refetch.
  const reload = () => setVersion((v) => v + 1)

  // Creates a board, clears the input and refetches.
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

  // Asks for confirmation, then soft-deletes the board (the API allows owners only).
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
