import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { ada, http, HttpResponse, url } from './test/utils'
import { server } from './test/server'

const title = (text: string) => screen.findByText(text, { selector: '[data-slot="card-title"]' })
const visit = (path: string) => window.history.pushState({}, '', path)
const loggedIn = () => server.use(
  http.get(url('/auth/me'), () => HttpResponse.json(ada)),
  http.get(url('/boards'), () => HttpResponse.json([])),
  http.get(url('/boards/archived'), () => HttpResponse.json([])),
  http.get(url('/boards/purged'), () => HttpResponse.json([])),
)
const loggedOut = () => server.use(http.get(url('/auth/me'), () => HttpResponse.json({ error: 'no' }, { status: 401 })))

afterEach(() => visit('/'))

describe('App routing', () => {
  it('sends a logged-out visitor from a private page to log in', async () => {
    loggedOut(); visit('/boards/7')
    render(<App />)
    expect(await title('Log in')).toBeInTheDocument()
  })

  it('shows the board list to a logged-in user', async () => {
    loggedIn(); visit('/')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Your boards' })).toBeInTheDocument()
  })

  it('keeps logged-in users off the login page', async () => {
    loggedIn(); visit('/login')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Your boards' })).toBeInTheDocument()
  })

  it.each([
    ['/register', 'Register'],
    ['/forgot-password', 'Forgot password'],
  ])('lets logged-out users reach %s', async (path, heading) => {
    loggedOut(); visit(path)
    render(<App />)
    expect(await title(heading)).toBeInTheDocument()
  })

  it('opens the reset-password link for anyone, logged in or not', async () => {
    loggedIn(); visit('/reset-password?token=abc')
    render(<App />)
    expect(await title('Choose a new password')).toBeInTheDocument()
  })
})
