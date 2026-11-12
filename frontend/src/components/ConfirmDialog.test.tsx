import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ConfirmDialog from './ConfirmDialog'

const mount = () => {
  const onConfirm = vi.fn(); const onClose = vi.fn()
  render(<ConfirmDialog title='Delete "X"?' description="Gone forever." confirmLabel="Delete it" onConfirm={onConfirm} onClose={onClose} />)
  return { onConfirm, onClose, user: userEvent.setup() }
}

describe('ConfirmDialog', () => {
  it('shows the title, description and confirm label', () => {
    mount()
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText('Delete "X"?')).toBeInTheDocument()
    expect(screen.getByText('Gone forever.')).toBeInTheDocument()
  })

  it('confirm runs the action and closes', async () => {
    const { user, onConfirm, onClose } = mount()
    await user.click(screen.getByRole('button', { name: 'Delete it' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalled()
  })

  it('cancel closes without confirming', async () => {
    const { user, onConfirm, onClose } = mount()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('Escape closes without confirming', async () => {
    const { user, onConfirm, onClose } = mount()
    await user.keyboard('{Escape}')
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})
