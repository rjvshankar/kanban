import { afterEach, describe, expect, it, vi } from 'vitest'
import { HttpResponse, http } from 'msw'
import { server } from '../test/server'
import { url } from '../test/utils'
import { ApiError, api, setUnauthorizedHandler } from './client'

afterEach(() => setUnauthorizedHandler(null))

describe('api client', () => {
  it('GET returns parsed JSON', async () => {
    server.use(http.get(url('/boards'), () => HttpResponse.json([{ id: 1 }])))
    expect(await api.get('/boards')).toEqual([{ id: 1 }])
  })

  it('sends the JSON body and content type, and includes the cookie', async () => {
    let seen: { method: string; type: string | null; body: unknown; credentials: string } | undefined
    server.use(http.post(url('/boards'), async ({ request }) => {
      seen = { method: request.method, type: request.headers.get('content-type'), body: await request.json(), credentials: request.credentials }
      return HttpResponse.json({ id: 2 }, { status: 201 })
    }))

    await api.post('/boards', { name: 'X' })

    expect(seen).toEqual({ method: 'POST', type: 'application/json', body: { name: 'X' }, credentials: 'same-origin' })
  })

  it('POST without a body sends an empty object', async () => {
    let body: unknown
    server.use(http.post(url('/auth/logout'), async ({ request }) => { body = await request.json(); return new HttpResponse(null, { status: 204 }) }))
    await api.post('/auth/logout')
    expect(body).toEqual({})
  })

  it('PATCH and DELETE use the right verbs', async () => {
    const methods: string[] = []
    server.use(
      http.patch(url('/boards/1'), () => { methods.push('PATCH'); return new HttpResponse(null, { status: 204 }) }),
      http.delete(url('/boards/1'), () => { methods.push('DELETE'); return new HttpResponse(null, { status: 204 }) }),
    )
    await api.patch('/boards/1', { name: 'n' })
    await api.delete('/boards/1')
    expect(methods).toEqual(['PATCH', 'DELETE'])
  })

  it('204 resolves to undefined without parsing', async () => {
    server.use(http.delete(url('/cards/1'), () => new HttpResponse(null, { status: 204 })))
    expect(await api.delete('/cards/1')).toBeUndefined()
  })

  describe('error messages', () => {
    const fail = (status: number, body: unknown): Promise<ApiError> => {
      server.use(http.get(url('/x'), () => (body === undefined ? new HttpResponse('not json', { status }) : HttpResponse.json(body as object, { status }))))
      return api.get('/x').then(() => { throw new Error('expected the request to fail') }, (e: unknown) => e as ApiError)
    }

    it('uses { error }', async () => {
      const e = await fail(409, { error: 'Email is already registered.' })
      expect(e).toBeInstanceOf(ApiError)
      expect(e).toMatchObject({ status: 409, message: 'Email is already registered.' })
    })

    it('joins ASP.NET validation errors', async () => {
      const e = await fail(400, { errors: { Email: ['Bad email.'], Password: ['Too short.', 'Too weak.'] } })
      expect(e.message).toBe('Bad email. Too short. Too weak.')
    })

    it('falls back to ProblemDetails title', async () => {
      expect((await fail(500, { title: 'Server exploded' })).message).toBe('Server exploded')
    })

    it('has a friendly message for rate limiting', async () => {
      expect((await fail(429, { error: 'ignored' })).message).toMatch(/too many requests/i)
    })

    it('has a generic message when the body is not JSON', async () => {
      expect(await fail(502, undefined)).toMatchObject({ status: 502, message: 'Something went wrong. Please try again.' })
    })
  })

  describe('401 handling', () => {
    it('calls the unauthorized handler for ordinary endpoints', async () => {
      const handler = vi.fn()
      setUnauthorizedHandler(handler)
      server.use(http.get(url('/boards'), () => HttpResponse.json({ error: 'no' }, { status: 401 })))

      await expect(api.get('/boards')).rejects.toMatchObject({ status: 401 })
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it.each(['/auth/login', '/auth/me'])('does not call it for %s (a 401 is expected there)', async (path) => {
      const handler = vi.fn()
      setUnauthorizedHandler(handler)
      server.use(http.all(url(path), () => HttpResponse.json({ error: 'no' }, { status: 401 })))

      await expect(api.get(path)).rejects.toMatchObject({ status: 401 })
      expect(handler).not.toHaveBeenCalled()
    })

    it('does not call it for other failures', async () => {
      const handler = vi.fn()
      setUnauthorizedHandler(handler)
      server.use(http.get(url('/boards'), () => HttpResponse.json({ error: 'no' }, { status: 403 })))

      await expect(api.get('/boards')).rejects.toBeInstanceOf(ApiError)
      expect(handler).not.toHaveBeenCalled()
    })
  })
})
