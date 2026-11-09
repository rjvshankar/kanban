// Tiny fetch wrapper for the backend API. All calls go to /api/* (proxied to the .NET API by Vite),
// send the httpOnly auth cookie, and turn failures into ApiError with a readable message.

// Thrown for any non-2xx response; carries the HTTP status so callers can branch on it (e.g. 404).
export class ApiError extends Error {
  // HTTP status code of the failed response.
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// Called when any request (other than the initial /me check) comes back 401,
// so AuthContext can drop the stale user and ProtectedRoute redirects to /login.
let onUnauthorized: (() => void) | null = null
// Registers (or clears, with null) the callback run on a 401.
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn
}

// Core request function: sends JSON plus the auth cookie, parses the reply, and throws ApiError on failure.
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  // The raw HTTP response.
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin', // sends the httpOnly auth cookie
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  // No Content: nothing to parse.
  if (res.status === 204) return undefined as T

  // Parsed JSON body, or null if the body is empty or not JSON.
  const data = await res.json().catch(() => null)

  if (!res.ok) {
    // A 401 elsewhere means the session expired; login and /me are excluded because a 401 is expected there.
    if (res.status === 401 && path !== '/auth/login' && path !== '/auth/me') onUnauthorized?.()
    throw new ApiError(res.status, extractMessage(data, res.status))
  }
  return data as T
}

// Handles { error: "..." }, 429 (rate limit), and ASP.NET ProblemDetails validation errors.
function extractMessage(data: unknown, status: number): string {
  if (status === 429) return 'Too many requests. Please wait a bit and try again.'
  if (data && typeof data === 'object') {
    const d = data as { error?: string; errors?: Record<string, string[]>; title?: string }
    if (d.error) return d.error
    if (d.errors) return Object.values(d.errors).flat().join(' ')
    if (d.title) return d.title
  }
  return 'Something went wrong. Please try again.'
}

// Public helpers used across the app. Paths are relative to /api, e.g. api.get("/boards").
export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}
