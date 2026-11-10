// React hook that keeps a board page live: it connects to the API's SignalR hub, joins the
// board's group, and calls onChange whenever the server says the board changed.
// The page reacts by refetching the board (the server stays the source of truth).

import { HubConnectionBuilder } from '@microsoft/signalr'
import { useEffect, useRef } from 'react'

// Subscribes to live changes of one board while the component is mounted.
export function useBoardRealtime(boardId: number, onChange: () => void) {
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

    // Joins the board's group, then refetches once to catch anything that changed while we weren't subscribed.
    const join = async () => {
      await connection.invoke('JoinBoard', boardId)
      onChangeRef.current()
    }

    // After an automatic reconnect the server has forgotten our group membership, so join again.
    connection.onreconnected(() => void join().catch(() => {}))
    // Failures here (e.g. StrictMode stopping the first connection mid-start) are harmless: the page still works without live updates.
    connection.start().then(join).catch(() => {})

    return () => {
      void connection.stop()
    }
  }, [boardId])
}
