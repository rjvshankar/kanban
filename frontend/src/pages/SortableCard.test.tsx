import { DndContext, MouseSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Card } from '../api/types'
import { CardFace, SortableCard } from './SortableCard'

const card: Card = { id: 3, title: 'Write tests', description: null, dueDate: '2030-05-06', position: 1000 }

describe('CardFace', () => {
  it('shows the title and due date', () => {
    render(<CardFace card={card} />)
    expect(screen.getByText('Write tests')).toBeInTheDocument()
    expect(screen.getByText('2030-05-06')).toBeInTheDocument()
  })

  it('omits the due date line when there is none', () => {
    render(<CardFace card={{ ...card, dueDate: null }} />)
    expect(screen.queryByText('2030-05-06')).not.toBeInTheDocument()
  })
})

// Same sensor as the board: a small movement starts a drag, so a plain click still opens the card.
function Harness({ disabled, onOpen }: { disabled: boolean; onOpen: () => void }) {
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 5 } }))
  return (
    <DndContext sensors={sensors}>
      <SortableContext items={['card-3']}><ul><SortableCard card={card} disabled={disabled} onOpen={onOpen} /></ul></SortableContext>
    </DndContext>
  )
}

describe('SortableCard', () => {
  const mount = (disabled: boolean) => {
    const onOpen = vi.fn()
    render(<Harness disabled={disabled} onOpen={onOpen} />)
    return { onOpen, user: userEvent.setup() }
  }

  it('opens on click', async () => {
    const { user, onOpen } = mount(false)
    await user.click(screen.getByText('Write tests'))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('still opens when dragging is disabled (viewers), with a pointer cursor instead of grab', async () => {
    const { user, onOpen } = mount(true)
    await user.click(screen.getByText('Write tests'))
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Write tests').parentElement).toHaveClass('cursor-pointer')
  })

  it('shows a grab cursor for users who can drag', () => {
    mount(false)
    expect(screen.getByText('Write tests').parentElement).toHaveClass('cursor-grab')
  })
})
