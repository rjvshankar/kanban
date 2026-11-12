// Runs before every test file: jest-dom matchers, the MSW server, and jsdom gaps that Radix/dnd-kit rely on.
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { server } from './server'

// Node's fetch rejects relative URLs ("/api/boards"); a browser resolves them against the page origin.
const nativeFetch = globalThis.fetch.bind(globalThis)
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
  typeof input === 'string' && input.startsWith('/')
    ? nativeFetch(new URL(input, window.location.origin), init)
    : nativeFetch(input, init)) as typeof fetch

// jsdom lacks these; Radix dialogs and sonner touch them.
window.matchMedia ??= ((query: string) => ({
  matches: false, media: query, onchange: null,
  addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
})) as unknown as typeof window.matchMedia
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
Element.prototype.scrollIntoView ??= vi.fn()
Element.prototype.hasPointerCapture ??= vi.fn(() => false)
Element.prototype.setPointerCapture ??= vi.fn()
Element.prototype.releasePointerCapture ??= vi.fn()

// Any request without a handler fails the test instead of silently hitting the network.
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
  vi.clearAllMocks()
})
afterAll(() => server.close())
