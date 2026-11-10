// One column on the board: a draggable header (handle), the sortable list of its cards,
// and an "add card" form. Rename/delete/open-card are handled by the parent.

import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Card, Column } from '../api/types'
import { SortableCard } from './SortableCard'

// Inputs: the column data, edit permission, and callbacks into BoardPage.
interface Props {
  column: Column
  canEdit: boolean // cards: add, drag, edit (owners and editors)
  canManage: boolean // the column itself: drag, rename, delete (owners)
  onRename: () => void
  onDelete: () => void
  onOpenCard: (card: Card) => void
  onAddCard: (title: string) => Promise<void>
}

// Renders the column; it is both a sortable item (horizontal) and a drop target for cards.
export default function SortableColumn({ column, canEdit, canManage, onRename, onDelete, onOpenCard, onAddCard }: Props) {
  // dnd-kit wiring for the column; the drag listeners are attached to the grip handle only, so dragging a card doesn't drag the column.
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: `col-${column.id}`,
    data: { type: 'column' },
    disabled: !canManage,
  })

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('w-72 shrink-0 rounded-xl bg-muted p-2', isDragging && 'opacity-40')}
    >
      <div className="flex items-center justify-between pb-2 pl-1">
        <div className="flex min-w-0 items-center gap-1">
          {canManage && (
            <Button
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              variant="ghost"
              size="icon-xs"
              aria-label="Drag column"
              className="cursor-grab touch-none text-muted-foreground"
            >
              <GripVertical />
            </Button>
          )}
          <h2 className="truncate text-sm font-semibold">{column.name}</h2>
          <span className="text-xs text-muted-foreground">{column.cards.length}</span>
        </div>
        {canManage && (
          <div className="flex">
            <Button variant="ghost" size="icon-xs" aria-label="Rename column" onClick={onRename} className="text-muted-foreground"><Pencil /></Button>
            <Button variant="ghost" size="icon-xs" aria-label="Delete column" onClick={onDelete} className="text-muted-foreground"><Trash2 /></Button>
          </div>
        )}
      </div>

      <SortableContext items={column.cards.map((c) => `card-${c.id}`)} strategy={verticalListSortingStrategy}>
        {/* min-height keeps an empty column a drop target */}
        <ul className="m-0 flex min-h-6 flex-col gap-2 p-0">
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
    <form onSubmit={submit} className="mt-2 flex gap-1">
      <Input placeholder="Add a card" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 min-w-0 flex-1 bg-background" />
      <Button type="submit" variant="ghost" size="icon" aria-label="Add card"><Plus /></Button>
    </form>
  )
}
