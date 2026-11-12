import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { api } from '../api/client'
import { ada, http, HttpResponse, url } from '../test/utils'
import { server } from '../test/server'
import { AuthProvider } from './AuthProvider'
import { useAuth, type AuthContextValue } from './auth-context'

let ctx: AuthContextValue
function Probe() {
  ctx = useAuth()
  return <p>{ctx.loading ? 'loading' : ctx.user ? `hello ${ctx.user.firstName}` : 'anonymous'}</p>
}
const mount = () => render(<AuthProvider><Probe /></AuthProvider>)
const me = (status: number, body: object = ada) => server.use(http.get(url('/auth/me'), () => HttpResponse.json(body, { status })))

describe('AuthProvider', () => {
  it('starts loading, then exposes the user from /auth/me', async () => {
    me(200)
    mount()
    expect(screen.getByText('loading')).toBeInTheDocument()
    expect(await screen.findByText('hello Ada')).toBeInTheDocument()
  })

  it('is anonymous when /auth/me fails', async () => {
    me(401, { error: 'no' })
    mount()
    expect(await screen.findByText('anonymous')).toBeInTheDocument()
  })

  it('login stores the returned user', async () => {
    me(401, { error: 'no' })
    server.use(http.post(url('/auth/login'), async ({ request }) => {
      expect(await request.json()).toEqual({ email: 'ada@example.com', password: 'pw' })
      return HttpResponse.json(ada)
    }))
    mount()
    await screen.findByText('anonymous')

    await act(() => ctx.login('ada@example.com', 'pw'))

    expect(screen.getByText('hello Ada')).toBeInTheDocument()
  })

  it('failed login rejects with the API message and stays logged out', async () => {
    me(401, { error: 'no' })
    server.use(http.post(url('/auth/login'), () => HttpResponse.json({ error: 'Invalid email or password.' }, { status: 401 })))
    mount()
    await screen.findByText('anonymous')

    await expect(act(() => ctx.login('a@b.c', 'bad'))).rejects.toThrow('Invalid email or password.')

    expect(screen.getByText('anonymous')).toBeInTheDocument()
  })

  it('register creates the account but does not log in', async () => {
    me(401, { error: 'no' })
    let posted: unknown
    server.use(http.post(url('/auth/register'), async ({ request }) => { posted = await request.json(); return HttpResponse.json({ id: 2 }, { status: 201 }) }))
    mount()
    await screen.findByText('anonymous')

    await act(() => ctx.register({ firstName: 'A', lastName: 'B', email: 'a@b.c', password: 'password1' }))

    expect(posted).toMatchObject({ email: 'a@b.c' })
    expect(screen.getByText('anonymous')).toBeInTheDocument()
  })

  it('logout clears the user', async () => {
    me(200)
    server.use(http.post(url('/auth/logout'), () => new HttpResponse(null, { status: 204 })))
    mount()
    await screen.findByText('hello Ada')

    await act(() => ctx.logout())

    expect(screen.getByText('anonymous')).toBeInTheDocument()
  })

  it('logout clears the user locally even if the request fails', async () => {
    me(200)
    server.use(http.post(url('/auth/logout'), () => HttpResponse.json({ error: 'boom' }, { status: 500 })))
    mount()
    await screen.findByText('hello Ada')

    const result = ctx.logout() // not wrapped in act: act skips flushing state when its callback rejects
    await expect(result).rejects.toThrow()

    await waitFor(() => expect(screen.getByText('anonymous')).toBeInTheDocument())
  })

  it('a 401 from any other request logs the user out locally', async () => {
    me(200)
    server.use(http.get(url('/boards'), () => HttpResponse.json({ error: 'expired' }, { status: 401 })))
    mount()
    await screen.findByText('hello Ada')

    await act(() => api.get('/boards').catch(() => {}))

    await waitFor(() => expect(screen.getByText('anonymous')).toBeInTheDocument())
  })
})
