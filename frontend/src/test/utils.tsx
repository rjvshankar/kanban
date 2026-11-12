// Test helpers: render with a router and a fake logged-in user, plus MSW URL/response shortcuts.
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { AuthContext, type AuthContextValue, type User } from '../auth/auth-context'
import type { Board, Role } from '../api/types'

export const ORIGIN = 'http://localhost:3000'
/** Absolute URL of an API path, e.g. url('/boards') for MSW handlers. */
export const url = (path: string) => `${ORIGIN}/api${path}`

export const ada: User = { id: 1, email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace' }

export { http, HttpResponse, userEvent }

/** Shows the current path and router state so tests can assert redirects. */
export function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="location" data-path={loc.pathname + loc.search} data-state={JSON.stringify(loc.state)} />
}

export const locationOf = (container: HTMLElement) => {
  const el = container.ownerDocument.querySelector('[data-testid="location"]')!
  return { path: el.getAttribute('data-path')!, state: JSON.parse(el.getAttribute('data-state') || 'null') as Record<string, unknown> | null }
}

interface Options {
  /** Where the router starts. */
  route?: string | { pathname: string; state?: unknown }
  /** Route pattern the element is mounted at (needed for :params). */
  path?: string
  /** Logged-in user; null = logged out. */
  user?: User | null
  auth?: Partial<AuthContextValue>
}

/** Renders `ui` inside a MemoryRouter and a fake auth context. Extra routes catch redirects. */
export function renderWithProviders(ui: ReactElement, { route = '/', path = '*', user = ada, auth }: Options = {}) {
  const value: AuthContextValue = {
    user, loading: false,
    login: async () => {}, register: async () => {}, logout: async () => {},
    ...auth,
  }
  const result = render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={ui} />
          <Route path="*" element={<div>other page</div>} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  return { ...result, user: userEvent.setup() }
}

export function makeBoard(role: Role = 'owner', overrides: Partial<Board> = {}): Board {
  return {
    id: 5, name: 'Roadmap', role, createdAt: '2026-01-01T00:00:00Z',
    columns: [
      { id: 10, name: 'To do', position: 1000, cards: [
        { id: 100, title: 'Write tests', description: 'All of them', dueDate: '2030-05-06', position: 1000 },
        { id: 101, title: 'Ship it', description: null, dueDate: null, position: 2000 },
      ] },
      { id: 11, name: 'Done', position: 2000, cards: [] },
    ],
    ...overrides,
  }
}
