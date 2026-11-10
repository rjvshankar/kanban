// A single card on the board, made draggable/sortable with dnd-kit.
// Clicking it (without dragging) opens the edit dialog.

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CalendarDays } from 'lucide-react'
import type { Card } from '../api/types'
import { cn } from '@/lib/utils'

// The card's visible box (title + due date); also reused as the floating drag preview.
export function CardFace({ card, className }: { card: Card; className?: string }) {
  return (
    <div className={cn('rounded-lg border bg-card px-3 py-2 text-sm shadow-xs', className)}>
      <div className="break-words">{card.title}</div>
      {card.dueDate && (
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarDays className="size-3" /> {card.dueDate}
        </div>
      )}
    </div>
  )
}

// A card that can be dragged and reordered. When disabled (viewers) it is just clickable.
export function SortableCard({ card, disabled, onOpen }: { card: Card; disabled: boolean; onOpen: () => void }) {
  // dnd-kit wiring: attributes/listeners make the element draggable, transform/transition animate it as others move, isDragging marks the one being held.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    // Prefixed so card ids never clash with column ids in dnd-kit.
    id: `card-${card.id}`,
    // Lets collision detection tell cards apart from columns.
    data: { type: 'card' },
    disabled,
  })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('list-none', isDragging && 'opacity-40')}
      onClick={onOpen}
      {...attributes}
      {...listeners}
    >
      <CardFace card={card} className={cn('transition-colors hover:border-ring/60', disabled ? 'cursor-pointer' : 'cursor-grab')} />
    </li>
  )
}
