import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { server } from '../test/server'
import { http, HttpResponse, locationOf, renderWithProviders, url } from '../test/utils'
import ResetPasswordPage from './ResetPasswordPage'

const mount = (route = '/reset-password?token=abc123') => renderWithProviders(<ResetPasswordPage />, { route, path: '/reset-password', user: null })

describe('ResetPasswordPage', () => {
  it('sends the token and new password, then goes to log in with a note', async () => {
    let body: unknown
    server.use(http.post(url('/auth/reset-password'), async ({ request }) => { body = await request.json(); return new HttpResponse(null, { status: 204 }) }))
    const { user, container } = mount()

    await user.type(screen.getByLabelText('New password (min 8 characters)'), 'NewPassword1!')
    await user.click(screen.getByRole('button', { name: 'Reset password' }))

    await screen.findByText('other page')
    expect(body).toEqual({ token: 'abc123', newPassword: 'NewPassword1!' })
    expect(locationOf(container)).toEqual({ path: '/login', state: { reset: true } })
  })

  it('shows the API error for an expired or used link', async () => {
    server.use(http.post(url('/auth/reset-password'), () => HttpResponse.json({ error: 'This reset link is invalid or has expired.' }, { status: 400 })))
    const { user } = mount()

    await user.type(screen.getByLabelText('New password (min 8 characters)'), 'NewPassword1!')
    await user.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('This reset link is invalid or has expired.')
    expect(screen.getByRole('button', { name: 'Reset password' })).toBeEnabled()
  })

  it('explains a link with no token and offers a new request', () => {
    mount('/reset-password')
    expect(screen.getByText(/missing its token/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Request a new one' })).toHaveAttribute('href', '/forgot-password')
    expect(screen.queryByRole('button', { name: 'Reset password' })).not.toBeInTheDocument()
  })
})
