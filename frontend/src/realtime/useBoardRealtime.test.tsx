import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// A fake SignalR connection we can drive by hand.
const conn = vi.hoisted(() => {
  const handlers: Record<string, () => void> = {}
  let reconnected: () => void = () => {}
  return {
    handlers,
    fireReconnected: () => reconnected(),
    start: vi.fn(),
    stop: vi.fn(),
    invoke: vi.fn(),
    on: vi.fn((name: string, fn: () => void) => { handlers[name] = fn }),
    onreconnected: vi.fn((fn: () => void) => { reconnected = fn }),
    withUrl: vi.fn(),
    withAutomaticReconnect: vi.fn(),
  }
})

vi.mock('@microsoft/signalr', () => ({
  HubConnectionBuilder: class {
    withUrl(u: string) { conn.withUrl(u); return this }
    withAutomaticReconnect() { conn.withAutomaticReconnect(); return this }
    build() { return conn }
  },
}))

import { useBoardRealtime } from './useBoardRealtime'

beforeEach(() => {
  for (const k of Object.keys(conn.handlers)) delete conn.handlers[k]
  conn.start.mockResolvedValue(undefined)
  conn.stop.mockResolvedValue(undefined)
  conn.invoke.mockResolvedValue(undefined)
})

describe('useBoardRealtime', () => {
  it('connects to the board hub with automatic reconnect, joins the board, then refetches once', async () => {
    const onChange = vi.fn()
    renderHook(() => useBoardRealtime(5, onChange))

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1)) // the catch-up refetch after joining
    expect(conn.withUrl).toHaveBeenCalledWith('/hubs/board')
    expect(conn.withAutomaticReconnect).toHaveBeenCalled()
    expect(conn.invoke).toHaveBeenCalledWith('JoinBoard', 5)
  })

  it('calls onChange for every BoardChanged ping', async () => {
    const onChange = vi.fn()
    renderHook(() => useBoardRealtime(5, onChange))
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))

    conn.handlers.BoardChanged()
    conn.handlers.BoardChanged()

    expect(onChange).toHaveBeenCalledTimes(3)
  })

  it('always calls the latest callback without reconnecting', async () => {
    const first = vi.fn(); const second = vi.fn()
    const { rerender } = renderHook(({ cb }) => useBoardRealtime(5, cb), { initialProps: { cb: first } })
    await waitFor(() => expect(first).toHaveBeenCalledTimes(1))

    rerender({ cb: second })
    conn.handlers.BoardChanged()

    expect(second).toHaveBeenCalledTimes(1)
    expect(first).toHaveBeenCalledTimes(1)
    expect(conn.start).toHaveBeenCalledTimes(1)
  })

  it('re-joins the board (and refetches) after an automatic reconnect', async () => {
    const onChange = vi.fn()
    renderHook(() => useBoardRealtime(5, onChange))
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))

    conn.fireReconnected()

    await waitFor(() => expect(conn.invoke).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2))
  })

  it('stops the connection on unmount', async () => {
    const { unmount } = renderHook(() => useBoardRealtime(5, vi.fn()))
    await waitFor(() => expect(conn.invoke).toHaveBeenCalled())

    unmount()

    expect(conn.stop).toHaveBeenCalled()
  })

  it('switches boards by reconnecting', async () => {
    const { rerender } = renderHook(({ id }) => useBoardRealtime(id, vi.fn()), { initialProps: { id: 5 } })
    await waitFor(() => expect(conn.invoke).toHaveBeenCalledWith('JoinBoard', 5))

    rerender({ id: 6 })

    await waitFor(() => expect(conn.invoke).toHaveBeenCalledWith('JoinBoard', 6))
    expect(conn.stop).toHaveBeenCalledTimes(1)
  })

  it('does not connect for an invalid board id', () => {
    renderHook(() => useBoardRealtime(Number('abc'), vi.fn()))
    expect(conn.start).not.toHaveBeenCalled()
  })

  it('survives a failed start (the page works without live updates)', async () => {
    conn.start.mockRejectedValue(new Error('offline'))
    const onChange = vi.fn()

    expect(() => renderHook(() => useBoardRealtime(5, onChange))).not.toThrow()

    await new Promise((r) => setTimeout(r, 20))
    expect(onChange).not.toHaveBeenCalled()
  })
})
