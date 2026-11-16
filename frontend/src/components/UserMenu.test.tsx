import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { THEME_COOKIE, readThemeCookie } from '@/theme/theme'
import { renderWithProviders } from '../test/utils'
import UserMenu from './UserMenu'

beforeEach(() => {
  document.cookie = `${THEME_COOKIE}=; Path=/; Max-Age=0`
  document.documentElement.classList.remove('dark')
})

async function open(props: Parameters<typeof renderWithProviders>[1] = {}) {
  const result = renderWithProviders(<UserMenu />, props)
  await result.user.click(screen.getByRole('button', { name: 'Account menu' }))
  return result
}

describe('UserMenu', () => {
  it('shows the avatar and first name on the trigger', () => {
    renderWithProviders(<UserMenu />)
    expect(screen.getByRole('button', { name: 'Account menu' })).toHaveTextContent('Ada')
  })

  it('lists who you are plus Edit profile, Dark mode and Log out', async () => {
    await open()
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /edit profile/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitemcheckbox', { name: 'Dark mode' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /log out/i })).toBeInTheDocument()
  })

  it('Edit profile opens the profile dialog', async () => {
    const { user } = await open()
    await user.click(screen.getByRole('menuitem', { name: /edit profile/i }))
    expect(await screen.findByRole('heading', { name: 'Your profile' })).toBeInTheDocument()
    expect(screen.getByLabelText('First name')).toHaveValue('Ada')
  })

  it('does not hand focus back to the menu button when it closes to open the dialog', async () => {
    const { user } = await open()
    await user.click(screen.getByRole('menuitem', { name: /edit profile/i }))
    await screen.findByRole('heading', { name: 'Your profile' })
    expect(screen.getByRole('button', { name: 'Account menu', hidden: true })).not.toHaveFocus()
  })

  it('Dark mode toggles the theme and saves the cookie, and keeps the menu open', async () => {
    const { user } = await open()
    const toggle = screen.getByRole('menuitemcheckbox', { name: 'Dark mode' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    await user.click(toggle)
    expect(document.documentElement).toHaveClass('dark')
    expect(readThemeCookie()).toBe('dark')
    expect(screen.getByRole('menuitemcheckbox', { name: 'Dark mode' })).toHaveAttribute('aria-checked', 'true')

    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Dark mode' }))
    expect(document.documentElement).not.toHaveClass('dark')
    expect(readThemeCookie()).toBe('light')
  })

  it('Log out calls logout', async () => {
    const logout = vi.fn().mockResolvedValue(undefined)
    const { user } = await open({ auth: { logout } })
    await user.click(screen.getByRole('menuitem', { name: /log out/i }))
    expect(logout).toHaveBeenCalled()
  })

  it('renders nothing when logged out', () => {
    renderWithProviders(<UserMenu />, { user: null })
    expect(screen.queryByRole('button', { name: 'Account menu' })).not.toBeInTheDocument()
  })
})
