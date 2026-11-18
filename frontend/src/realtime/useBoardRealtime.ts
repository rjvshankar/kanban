// React hook that keeps a board page live: it connects to the API's SignalR hub, joins the
// board's group, calls onChange whenever the server says the board changed, and tracks who else has the board open.
// The page reacts by refetching the board (the server stays the source of truth).

import { HubConnectionBuilder } from '@microsoft/signalr'
import { useEffect, useRef, useState } from 'react'

// Someone currently viewing the board (same shape as the server's PresenceViewer).
export interface Viewer {
  id: number
  firstName: string
  lastName: string
  avatarVersion?: number | null
}

// Subscribes to live changes of one board while the component is mounted. Returns the current viewers (including you).
export function useBoardRealtime(boardId: number, onChange: () => void): Viewer[] {
  const [viewers, setViewers] = useState<Viewer[]>([])
  // Always points at the latest onChange, so the connection below needn't be rebuilt when the callback changes.
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  useEffect(() => {
    if (!Number.isFinite(boardId)) return

    // Same-origin URL (proxied to the API in dev), so the httpOnly auth cookie is sent automatically.
    const connection = new HubConnectionBuilder().withUrl('/hubs/board').withAutomaticReconnect().build()

    connection.on('BoardChanged', () => onChangeRef.current())
    // The server sends the full list every time, so we just replace ours.
    connection.on('PresenceChanged', (list: Viewer[]) => setViewers(list))

    // Joins the board's group, then refetches once to catch anything that changed while we weren't subscribed.
    const join = async () => {
      setViewers(await connection.invoke<Viewer[]>('JoinBoard', boardId))
      onChangeRef.current()
    }

    // After an automatic reconnect the server has forgotten our group membership, so join again.
    connection.onreconnected(() => void join().catch(() => {}))
    // Failures here (e.g. StrictMode stopping the first connection mid-start) are harmless: the page still works without live updates.
    connection.start().then(join).catch(() => {})

    return () => {
      void connection.stop()
      setViewers([])
    }
  }, [boardId])

  return viewers
}
