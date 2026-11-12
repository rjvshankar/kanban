import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import NameDialog from './NameDialog'

const mount = (initial = 'Old name') => {
  const onSubmit = vi.fn(); const onClose = vi.fn()
  render(<NameDialog title="Rename column" initial={initial} onSubmit={onSubmit} onClose={onClose} />)
  return { onSubmit, onClose, user: userEvent.setup(), input: screen.getByRole('textbox') }
}

describe('NameDialog', () => {
  it('starts with the current name', () => {
    const { input } = mount()
    expect(screen.getByRole('dialog', { name: 'Rename column' })).toBeInTheDocument()
    expect(input).toHaveValue('Old name')
  })

  it('submits the trimmed name and closes', async () => {
    const { user, input, onSubmit, onClose } = mount()
    await user.clear(input)
    await user.type(input, '  New name  ')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSubmit).toHaveBeenCalledWith('New name')
    expect(onClose).toHaveBeenCalled()
  })

  it('ignores a name that is only spaces', async () => {
    const { user, input, onSubmit, onClose } = mount()
    await user.clear(input)
    await user.type(input, '   ')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('cancel closes without submitting', async () => {
    const { user, onSubmit, onClose } = mount()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})
