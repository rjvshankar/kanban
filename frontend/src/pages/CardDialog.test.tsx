import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Card } from '../api/types'
import CardDialog from './CardDialog'

const card: Card = { id: 1, title: 'Write tests', description: 'All of them', dueDate: '2030-05-06', position: 1000 }

const mount = (props: Partial<Parameters<typeof CardDialog>[0]> = {}) => {
  const onSave = vi.fn().mockResolvedValue(undefined); const onDelete = vi.fn(); const onClose = vi.fn()
  render(<CardDialog card={card} canEdit onSave={onSave} onDelete={onDelete} onClose={onClose} {...props} />)
  return { onSave, onDelete, onClose, user: userEvent.setup() }
}

describe('CardDialog', () => {
  it('shows the card in editable fields', () => {
    mount()
    expect(screen.getByText('Edit card')).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toHaveValue('Write tests')
    expect(screen.getByLabelText('Description')).toHaveValue('All of them')
    expect(screen.getByLabelText('Due date')).toHaveValue('2030-05-06')
  })

  it('saves edited fields', async () => {
    const { user, onSave } = mount()
    await user.clear(screen.getByLabelText('Title'))
    await user.type(screen.getByLabelText('Title'), 'New title')
    await user.clear(screen.getByLabelText('Description'))
    await user.type(screen.getByLabelText('Description'), 'New text')
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2031-01-02' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSave).toHaveBeenCalledWith({ title: 'New title', description: 'New text', dueDate: '2031-01-02' })
  })

  it('sends null for a blank description and no due date so the API clears them', async () => {
    const { user, onSave } = mount()
    await user.clear(screen.getByLabelText('Description'))
    await user.type(screen.getByLabelText('Description'), '   ')
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSave).toHaveBeenCalledWith({ title: 'Write tests', description: null, dueDate: null })
  })

  it('shows empty fields for a card with no description or date', () => {
    mount({ card: { ...card, description: null, dueDate: null } })
    expect(screen.getByLabelText('Description')).toHaveValue('')
    expect(screen.getByLabelText('Due date')).toHaveValue('')
  })

  it('disables Save while saving', async () => {
    let finish!: () => void
    const { user } = mount({ onSave: vi.fn(() => new Promise<void>((r) => { finish = r })) })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    finish()
  })

  it('Delete hands over to the parent', async () => {
    const { user, onDelete } = mount()
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalled()
  })

  it('is read-only for viewers: disabled fields, Close instead of Save and Delete', async () => {
    const { user, onClose } = mount({ canEdit: false })

    expect(screen.getByText('Card')).toBeInTheDocument()
    for (const label of ['Title', 'Description', 'Due date']) expect(screen.getByLabelText(label)).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()

    const closers = screen.getAllByRole('button', { name: 'Close' }) // the footer button and the dialog's corner X
    expect(closers).toHaveLength(2)
    await user.click(closers[0])
    expect(onClose).toHaveBeenCalled()
  })

  it('Escape closes', async () => {
    const { user, onClose } = mount()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
})
