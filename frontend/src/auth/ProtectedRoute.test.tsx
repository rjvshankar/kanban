import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ada, LocationProbe, locationOf } from '../test/utils'
import { AuthContext, type User } from './auth-context'
import { GuestRoute, ProtectedRoute } from './ProtectedRoute'

function mount(route: string, user: User | null, loading = false) {
  return render(
    <AuthContext.Provider value={{ user, loading, login: async () => {}, register: async () => {}, logout: async () => {} }}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route element={<GuestRoute />}><Route path="/login" element={<p>login page</p>} /></Route>
          <Route element={<ProtectedRoute />}><Route path="/" element={<p>home</p>} /><Route path="/boards/:id" element={<p>board</p>} /></Route>
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('ProtectedRoute', () => {
  it('renders the page for a logged-in user', () => {
    mount('/', ada)
    expect(screen.getByText('home')).toBeInTheDocument()
  })

  it('redirects to /login and remembers where the user was going', () => {
    const { container } = mount('/boards/7', null)
    expect(screen.getByText('login page')).toBeInTheDocument()
    expect(locationOf(container)).toEqual({ path: '/login', state: { from: '/boards/7' } })
  })

  it('shows a loading state, not a redirect, while the session check runs', () => {
    mount('/boards/7', null, true)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByText('login page')).not.toBeInTheDocument()
  })
})

describe('GuestRoute', () => {
  it('shows the login page to logged-out users', () => {
    mount('/login', null)
    expect(screen.getByText('login page')).toBeInTheDocument()
  })

  it('sends logged-in users home', () => {
    const { container } = mount('/login', ada)
    expect(screen.getByText('home')).toBeInTheDocument()
    expect(locationOf(container).path).toBe('/')
  })

  it('waits while loading', () => {
    mount('/login', null, true)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })
})
