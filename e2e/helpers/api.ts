// Fast set-up through the real API (via the Vite proxy). Tests use the UI for what they are *testing*
// and these helpers for everything they merely need to exist first.
import type { APIRequestContext, APIResponse, Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'

export const PASSWORD = 'Password123!'

export interface TestUser { id: number; email: string; password: string; firstName: string; lastName: string }

/** Registers a new user with a unique email. Does not log in. */
export async function registerUser(request: APIRequestContext, firstName = 'Test'): Promise<TestUser> {
  const lastName = `U${randomUUID().slice(0, 8)}`
  const email = `${firstName}.${lastName}@example.com`.toLowerCase()
  const res = await request.post('/api/auth/register', { data: { firstName, lastName, email, password: PASSWORD } })
  if (!res.ok()) throw new Error(`register failed: ${res.status()} ${await res.text()}`)
  const { id } = await res.json()
  return { id, email, password: PASSWORD, firstName, lastName }
}

/** Logs the request context in (the cookie is stored on it, and shared with its page). */
export async function login(request: APIRequestContext, user: TestUser) {
  const res = await request.post('/api/auth/login', { data: { email: user.email, password: user.password } })
  if (!res.ok()) throw new Error(`login failed: ${res.status()}`)
}

/** Register + log in the page's browser context in one go. */
export async function signUpAndLogin(page: Page, firstName = 'Test'): Promise<TestUser> {
  const user = await registerUser(page.request, firstName)
  await login(page.request, user)
  return user
}

async function ok<T>(pending: Promise<APIResponse>): Promise<T> {
  const res = await pending
  if (!res.ok()) throw new Error(`${res.url()} -> ${res.status()} ${await res.text()}`)
  return res.status() === 204 ? (undefined as T) : ((await res.json()) as T)
}

export const createBoard = (request: APIRequestContext, name: string) =>
  ok<{ id: number }>(request.post('/api/boards', { data: { name } })).then((b) => b.id)

export const createColumn = (request: APIRequestContext, boardId: number, name: string) =>
  ok<{ id: number }>(request.post(`/api/boards/${boardId}/columns`, { data: { name } })).then((c) => c.id)

export const createCard = (request: APIRequestContext, columnId: number, title: string, extra: { description?: string; dueDate?: string } = {}) =>
  ok<{ id: number }>(request.post(`/api/columns/${columnId}/cards`, { data: { title, ...extra } })).then((c) => c.id)

export const addMember = (request: APIRequestContext, boardId: number, user: TestUser, role: 'owner' | 'editor' | 'viewer') =>
  ok<void>(request.post(`/api/boards/${boardId}/members`, { data: { userId: user.id, role } }))

export const changeRole = (request: APIRequestContext, boardId: number, user: TestUser, role: 'owner' | 'editor' | 'viewer') =>
  ok<void>(request.patch(`/api/boards/${boardId}/members/${user.id}`, { data: { role } }))

export const removeMember = (request: APIRequestContext, boardId: number, user: TestUser) =>
  ok<void>(request.delete(`/api/boards/${boardId}/members/${user.id}`))

export const deleteBoard = (request: APIRequestContext, boardId: number) =>
  ok<void>(request.delete(`/api/boards/${boardId}`))

/** Board with the given columns, each with the given card titles. Returns ids by name. */
export async function seedBoard(request: APIRequestContext, name: string, columns: Record<string, string[]>) {
  const boardId = await createBoard(request, name)
  const columnIds: Record<string, number> = {}
  for (const [colName, cards] of Object.entries(columns)) {
    columnIds[colName] = await createColumn(request, boardId, colName)
    for (const title of cards) await createCard(request, columnIds[colName], title)
  }
  return { boardId, columnIds }
}
