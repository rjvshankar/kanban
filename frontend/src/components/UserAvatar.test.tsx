import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import UserAvatar from './UserAvatar'

const ada = { id: 7, firstName: 'Ada', lastName: 'Lovelace' }

describe('UserAvatar', () => {
  it('shows initials when there is no picture', () => {
    const { container } = render(<UserAvatar user={ada} />)
    expect(screen.getByText('AL')).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
  })

  it('shows the saved picture with a cache-busting version', () => {
    const { container } = render(<UserAvatar user={{ ...ada, avatarVersion: 123 }} />)
    expect(container.querySelector('img')).toHaveAttribute('src', '/api/users/7/avatar?v=123')
  })

  it('falls back to initials when the image fails to load', () => {
    const { container } = render(<UserAvatar user={{ ...ada, avatarVersion: 1 }} />)
    fireEvent.error(container.querySelector('img')!)
    expect(screen.getByText('AL')).toBeInTheDocument()
  })

  it('src overrides the saved picture; null forces initials', () => {
    const { container, rerender } = render(<UserAvatar user={{ ...ada, avatarVersion: 1 }} src="blob:preview" />)
    expect(container.querySelector('img')).toHaveAttribute('src', 'blob:preview')
    rerender(<UserAvatar user={{ ...ada, avatarVersion: 1 }} src={null} />)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('AL')).toBeInTheDocument()
  })
})
