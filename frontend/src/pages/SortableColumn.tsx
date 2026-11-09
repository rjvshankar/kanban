// One column on the board: a draggable header (handle), the sortable list of its cards,
// and an "add card" form. Rename/delete/open-card are handled by the parent.

import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState, type FormEvent } from 'react'
import type { Card, Column } from '../api/types'
import { columnBoxStyle } from './board-styles'
import { SortableCard } from './SortableCard'

// Inputs: the column data, edit permission, and callbacks into BoardPage.
interface Props {
  column: Column
  canEdit: boolean
  onRename: () => void
  onDelete: () => void
  onOpenCard: (card: Card) => void
  onAddCard: (title: string) => Promise<void>
}

// Renders the column; it is both a sortable item (horizontal) and a drop target for cards.
export default function SortableColumn({ column, canEdit, onRename, onDelete, onOpenCard, onAddCard }: Props) {
  // dnd-kit wiring for the column; the drag listeners are attached to the ⠿ handle only, so dragging a card doesn't drag the column.
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: `col-${column.id}`,
    data: { type: 'column' },
    disabled: !canEdit,
  })

  return (
    <section
      ref={setNodeRef}
      style={{ ...columnBoxStyle, transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>
          {canEdit && (
            <button ref={setActivatorNodeRef} {...attributes} {...listeners} title="Drag column" style={{ cursor: 'grab', touchAction: 'none' }}>⠿</button>
          )}{' '}
          <strong>{column.name}</strong>
        </span>
        {canEdit && (
          <span>
            <button onClick={onRename} title="Rename">✎</button>
            <button onClick={onDelete} title="Delete">✕</button>
          </span>
        )}
      </div>

      <SortableContext items={column.cards.map((c) => `card-${c.id}`)} strategy={verticalListSortingStrategy}>
        {/* min-height keeps an empty column a drop target */}
        <ul style={{ padding: 0, margin: '0.5rem 0', minHeight: 24 }}>
          {column.cards.map((card) => (
            <SortableCard key={card.id} card={card} disabled={!canEdit} onOpen={() => onOpenCard(card)} />
          ))}
        </ul>
      </SortableContext>

      {canEdit && <AddCardForm onAdd={onAddCard} />}
    </section>
  )
}

// Inline form at the bottom of a column to add a card by title.
function AddCardForm({ onAdd }: { onAdd: (title: string) => Promise<void> }) {
  // Form field: new card title.
  const [title, setTitle] = useState('')

  // Clears the input immediately and asks the parent to create the card.
  async function submit(e: FormEvent) {
    e.preventDefault()
    // Copy the value first, because the state is cleared on the next line.
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
