import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { server } from '../test/server'
import { http, HttpResponse, renderWithProviders, url } from '../test/utils'
import ForgotPasswordPage from './ForgotPasswordPage'

const mount = () => renderWithProviders(<ForgotPasswordPage />, { route: '/forgot-password', path: '/forgot-password', user: null })

describe('ForgotPasswordPage', () => {
  it('requests a reset link and shows the same neutral confirmation', async () => {
    let body: unknown
    server.use(http.post(url('/auth/forgot-password'), async ({ request }) => { body = await request.json(); return HttpResponse.json({ message: 'ok' }) }))
    const { user } = mount()

    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByText('If that email is registered, a reset link has been sent.')).toBeInTheDocument()
    expect(body).toEqual({ email: 'ada@example.com' })
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
  })

  it('shows the rate-limit message and keeps the form', async () => {
    server.use(http.post(url('/auth/forgot-password'), () => HttpResponse.json({ error: 'x' }, { status: 429 })))
    const { user } = mount()

    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/too many requests/i)
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeEnabled()
  })

  it('links back to log in', () => {
    mount()
    expect(screen.getByRole('link', { name: 'Back to log in' })).toHaveAttribute('href', '/login')
  })
})
