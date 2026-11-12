import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { locationOf, renderWithProviders } from '../test/utils'
import LoginPage from './LoginPage'

type Route = string | { pathname: string; state?: unknown }
const mount = (login = vi.fn().mockResolvedValue(undefined), route: Route = '/login') =>
  ({ login, ...renderWithProviders(<LoginPage />, { route, path: '/login', user: null, auth: { login } }) })

async function fillAndSubmit(user: ReturnType<typeof mount>['user'], email = 'ada@example.com', password = 'secret123') {
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Password'), password)
  await user.click(screen.getByRole('button', { name: 'Log in' }))
}

describe('LoginPage', () => {
  it('logs in with the entered credentials and goes home', async () => {
    const { user, login, container } = mount()
    await fillAndSubmit(user)

    expect(login).toHaveBeenCalledWith('ada@example.com', 'secret123')
    expect(await screen.findByText('other page')).toBeInTheDocument()
    expect(locationOf(container).path).toBe('/')
  })

  it('returns to the page the user was trying to reach', async () => {
    const { user, container } = mount(undefined, { pathname: '/login', state: { from: '/boards/7' } })
    await fillAndSubmit(user)

    await screen.findByText('other page')
    expect(locationOf(container).path).toBe('/boards/7')
  })

  it('shows the error and lets the user retry', async () => {
    const { user } = mount(vi.fn().mockRejectedValue(new Error('Invalid email or password.')))
    await fillAndSubmit(user, 'ada@example.com', 'wrong')

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.')
    expect(screen.getByRole('button', { name: 'Log in' })).toBeEnabled()
  })

  it('disables the button while the request runs', async () => {
    let resolve!: () => void
    const { user } = mount(vi.fn(() => new Promise<void>((r) => { resolve = r })))
    await fillAndSubmit(user)

    expect(screen.getByRole('button', { name: 'Logging in...' })).toBeDisabled()
    resolve()
  })

  it('clears a previous error on the next attempt', async () => {
    const login = vi.fn().mockRejectedValueOnce(new Error('nope')).mockResolvedValue(undefined)
    const { user } = mount(login)
    await fillAndSubmit(user)
    await screen.findByRole('alert')

    await user.click(screen.getByRole('button', { name: 'Log in' }))

    await screen.findByText('other page')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each([
    [{ registered: true }, 'Account created. Please log in.'],
    [{ reset: true }, 'Password updated. Please log in.'],
  ])('shows a success note after %o', (state, text) => {
    mount(undefined, { pathname: '/login', state })
    expect(screen.getByText(text)).toBeInTheDocument()
  })

  it('has no note on a plain visit and links to register and forgot-password', () => {
    mount()
    expect(screen.queryByText(/please log in/i)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Register' })).toHaveAttribute('href', '/register')
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute('href', '/forgot-password')
  })
})
