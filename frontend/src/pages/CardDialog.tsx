import { useState, type FormEvent } from 'react'
import type { Card } from '../api/types'

export interface CardFields {
  title: string
  description: string | null
  dueDate: string | null
}

interface Props {
  card: Card
  canEdit: boolean
  onSave: (fields: CardFields) => Promise<void>
  onDelete: () => Promise<void>
  onClose: () => void
}

export default function CardDialog({ card, canEdit, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(card.title)
  const [description, setDescription] = useState(card.description ?? '')
  const [dueDate, setDueDate] = useState(card.dueDate ?? '')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    await onSave({ title, description: description.trim() || null, dueDate: dueDate || null })
    setBusy(false)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'grid', placeItems: 'center' }}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        style={{ background: 'var(--bg)', color: 'var(--text-h)', padding: '1rem', width: 'min(440px, 92vw)', borderRadius: 8, display: 'grid', gap: '0.6rem' }}
      >
        <label>Title<input required maxLength={200} disabled={!canEdit} value={title} onChange={(e) => setTitle(e.target.value)} style={{ display: 'block', width: '100%', boxSizing: 'border-box' }} /></label>
        <label>Description<textarea rows={5} maxLength={4000} disabled={!canEdit} value={description} onChange={(e) => setDescription(e.target.value)} style={{ display: 'block', width: '100%', boxSizing: 'border-box' }} /></label>
        <label>Due date<input type="date" disabled={!canEdit} value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ display: 'block' }} /></label>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between' }}>
          <span>
            {canEdit && <button type="submit" disabled={busy}>Save</button>}{' '}
            <button type="button" onClick={onClose}>Close</button>
          </span>
          {canEdit && <button type="button" onClick={() => void onDelete()}>Delete card</button>}
        </div>
      </form>
    </div>
  )
}
