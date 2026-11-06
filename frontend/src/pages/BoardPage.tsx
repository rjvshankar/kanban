import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError, api } from '../api/client'
import type { Board, Card } from '../api/types'
import CardDialog, { type CardFields } from './CardDialog'
import { FormError } from './Form'

export default function BoardPage() {
  const { id } = useParams()
  const [board, setBoard] = useState<Board | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [version, setVersion] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [newColumn, setNewColumn] = useState('')
  const [editing, setEditing] = useState<Card | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .get<Board>(`/boards/${id}`)
      .then((b) => !cancelled && setBoard(b))
      .catch((e) => {
        if (cancelled) return
        if (e instanceof ApiError && e.status === 404) setNotFound(true)
        else setError(e instanceof Error ? e.message : 'Failed to load board.')
      })
    return () => {
      cancelled = true
    }
  }, [id, version])

  const reload = () => setVersion((v) => v + 1)

  // Runs a mutation, shows any error, and refetches the board afterwards.
  async function run(fn: () => Promise<unknown>) {
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    }
    reload()
  }

  if (notFound) return <main style={{ padding: '1rem' }}><p>Board not found.</p><Link to="/">Back to boards</Link></main>
  if (!board) return <main style={{ padding: '1rem' }}><FormError message={error} /><p>Loading...</p></main>

  const canEdit = board.role !== 'viewer'
  const cols = board.columns

  function renameBoard() {
    const name = prompt('Board name', board!.name)?.trim()
    if (name && name !== board!.name) void run(() => api.patch(`/boards/${board!.id}`, { name }))
  }

  function addColumn(e: FormEvent) {
    e.preventDefault()
    const name = newColumn
    setNewColumn('')
    void run(() => api.post(`/boards/${board!.id}/columns`, { name }))
  }

  const renameColumn = (colId: number, current: string) => {
    const name = prompt('Column name', current)?.trim()
    if (name && name !== current) void run(() => api.patch(`/columns/${colId}`, { name }))
  }

  const deleteColumn = (colId: number, name: string) => {
    if (confirm(`Delete column "${name}" and its cards?`)) void run(() => api.delete(`/columns/${colId}`))
  }

  // afterColumnId = the column that should sit right before it after the move (null = first).
  const moveColumn = (index: number, dir: -1 | 1) => {
    const after = dir === -1 ? (cols[index - 2]?.id ?? null) : cols[index + 1].id
    void run(() => api.post(`/columns/${cols[index].id}/move`, { afterColumnId: after }))
  }

  const addCard = (colId: number, title: string) =>
    run(() => api.post(`/columns/${colId}/cards`, { title }))

  const moveCard = (cardId: number, toColumnId: number, afterCardId: number | null) =>
    void run(() => api.post(`/cards/${cardId}/move`, { toColumnId, afterCardId }))

  return (
    <main style={{ padding: '1rem' }}>
      <header style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <Link to="/">&larr; Boards</Link>
        <h1 style={{ margin: 0 }}>{board.name}</h1>
        {board.role !== 'viewer' && <button onClick={renameBoard}>Rename</button>}
        <small>{board.role}</small>
      </header>
      <FormError message={error} />

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', overflowX: 'auto', marginTop: '1rem' }}>
        {cols.map((col, ci) => (
          <section key={col.id} style={{ minWidth: 260, width: 260, border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>{col.name}</strong>
              {canEdit && (
                <span>
                  <button disabled={ci === 0} onClick={() => moveColumn(ci, -1)} title="Move left">&larr;</button>
                  <button disabled={ci === cols.length - 1} onClick={() => moveColumn(ci, 1)} title="Move right">&rarr;</button>
                  <button onClick={() => renameColumn(col.id, col.name)} title="Rename">✎</button>
                  <button onClick={() => deleteColumn(col.id, col.name)} title="Delete">✕</button>
                </span>
              )}
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0' }}>
              {col.cards.map((card, i) => (
                <li key={card.id} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '0.4rem', marginBottom: '0.4rem' }}>
                  <div onClick={() => setEditing(card)} style={{ cursor: 'pointer' }}>
                    {card.title}
                    {card.dueDate && <div><small>Due {card.dueDate}</small></div>}
                  </div>
                  {canEdit && (
                    <div>
                      <button disabled={i === 0} onClick={() => moveCard(card.id, col.id, col.cards[i - 2]?.id ?? null)} title="Up">↑</button>
                      <button disabled={i === col.cards.length - 1} onClick={() => moveCard(card.id, col.id, col.cards[i + 1].id)} title="Down">↓</button>
                      <button disabled={ci === 0} onClick={() => moveCard(card.id, cols[ci - 1].id, cols[ci - 1].cards.at(-1)?.id ?? null)} title="To left column">&larr;</button>
                      <button disabled={ci === cols.length - 1} onClick={() => moveCard(card.id, cols[ci + 1].id, cols[ci + 1].cards.at(-1)?.id ?? null)} title="To right column">&rarr;</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {canEdit && <AddCardForm onAdd={(title) => addCard(col.id, title)} />}
          </section>
        ))}

        {canEdit && (
          <form onSubmit={addColumn} style={{ minWidth: 220 }}>
            <input placeholder="New column" required maxLength={200} value={newColumn} onChange={(e) => setNewColumn(e.target.value)} />
            <button type="submit">Add</button>
          </form>
        )}
      </div>

      {editing && (
        <CardDialog
          key={editing.id}
          card={editing}
          canEdit={canEdit}
          onClose={() => setEditing(null)}
          onSave={async (fields: CardFields) => {
            await run(() => api.patch(`/cards/${editing.id}`, fields))
            setEditing(null)
          }}
          onDelete={async () => {
            if (!confirm('Delete this card?')) return
            await run(() => api.delete(`/cards/${editing.id}`))
            setEditing(null)
          }}
        />
      )}
    </main>
  )
}

function AddCardForm({ onAdd }: { onAdd: (title: string) => Promise<void> }) {
  const [title, setTitle] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    const t = title
    setTitle('')
    await onAdd(t)
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: '0.3rem' }}>
      <input placeholder="Add a card" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
      <button type="submit">+</button>
    </form>
  )
}
