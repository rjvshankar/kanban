// A single card on the board, made draggable/sortable with dnd-kit.
// Clicking it (without dragging) opens the edit dialog.

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Card } from '../api/types'
import { cardBoxStyle } from './board-styles'

// The card's visible content (title + due date); also reused inside the drag preview.
export function CardBody({ card }: { card: Card }) {
  return (
    <>
      {card.title}
      {card.dueDate && <div><small>Due {card.dueDate}</small></div>}
    </>
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
      style={{ ...cardBoxStyle, transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.4 : 1, cursor: disabled ? 'pointer' : 'grab' }}
      onClick={onOpen}
      {...attributes}
      {...listeners}
    >
      <CardBody card={card} />
    </li>
  )
}
