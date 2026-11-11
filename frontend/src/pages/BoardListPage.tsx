// Home page: lists the boards you belong to, with create and delete (owner only).

import { useEffect, useState, type FormEvent } from 'react'
import { LogOut, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '../api/client'
import type { ArchivedBoard, BoardSummary, PurgedBoard } from '../api/types'
import { useAuth } from '../auth/auth-context'

// Board list screen.
export default function BoardListPage() {
  // Current user (for the greeting) and the logout action.
  const { user, logout } = useAuth()
  // The board list; null until the first load finishes.
  const [boards, setBoards] = useState<BoardSummary[] | null>(null)
  // Bumping this re-runs the load effect, which is how we refetch.
  const [version, setVersion] = useState(0)
  // Deleted boards the user can still restore; empty until loaded.
  const [archived, setArchived] = useState<ArchivedBoard[]>([])
  // Boards moved to the long-term archive that the user owned; restoring one returns it to `archived`.
  const [purged, setPurged] = useState<PurgedBoard[]>([])
  // Form field: name of the board to create.
  const [name, setName] = useState('')
  // The board waiting for delete confirmation, or null.
  const [toDelete, setToDelete] = useState<BoardSummary | null>(null)

  // Loads the board list on mount and whenever version changes.
  useEffect(() => {
    // Set by cleanup so a late response is ignored after unmount.
    let cancelled = false
    api
      .get<BoardSummary[]>('/boards')
      .then((b) => !cancelled && setBoards(b))
      .catch((e) => !cancelled && toast.error(e instanceof Error ? e.message : 'Failed to load boards.'))
    api
      .get<ArchivedBoard[]>('/boards/archived')
      .then((a) => !cancelled && setArchived(a))
      .catch(() => {}) // the archive list is optional; the main list already reports load errors
    api
      .get<PurgedBoard[]>('/boards/purged')
      .then((p) => !cancelled && setPurged(p))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [version])

  // Triggers a refetch.
  const reload = () => setVersion((v) => v + 1)

  // Creates a board, clears the input and refetches.
  async function onCreate(e: FormEvent) {
    e.preventDefault()
    try {
      await api.post('/boards', { name })
      setName('')
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create board.')
    }
  }

  // Soft-deletes the board after the user confirmed (the API allows owners only).
  async function onDelete(b: BoardSummary) {
    try {
      await api.delete(`/boards/${b.id}`)
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete board.')
    }
  }

  // Brings an archived board back (owners only), then refetches both lists.
  async function onRestore(b: ArchivedBoard) {
    try {
      await api.post(`/boards/${b.id}/restore`)
      toast.success(`Restored "${b.name}".`)
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not restore board.')
      reload()
    }
  }

  // Moves a long-term-archived board back to Archived boards; the owner then restores it as usual.
  async function onRestorePurged(b: PurgedBoard) {
    try {
      await api.post(`/boards/${b.id}/restore-purged`)
      toast.success(`"${b.name}" moved to Archived boards. Restore it from there.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not retrieve board.')
    }
    reload()
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="flex items-center justify-between border-b bg-background px-4 py-3">
        <span className="font-semibold">Kanban</span>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {user?.firstName}
          <Button variant="ghost" size="sm" onClick={() => void logout()}><LogOut /> Log out</Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl p-4 pt-8">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">Your boards</h1>

        <form onSubmit={onCreate} className="mb-6 flex gap-2">
          <Input placeholder="New board name" required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} className="h-9 bg-background" />
          <Button type="submit" size="lg"><Plus /> Create</Button>
        </form>

        {boards === null ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : boards.length === 0 ? (
          <p className="text-sm text-muted-foreground">No boards yet. Create one above.</p>
        ) : (
          <ul className="grid gap-2">
            {boards.map((b) => (
              <li key={b.id} className="flex items-center justify-between rounded-lg border bg-card transition-colors hover:border-ring/60">
                <Link to={`/boards/${b.id}`} className="flex-1 px-4 py-3 font-medium">{b.name}</Link>
                <div className="flex items-center gap-1 pr-2">
                  <span className="text-xs capitalize text-muted-foreground">{b.role}</span>
                  {b.role === 'owner' && (
                    <Button variant="ghost" size="icon-sm" aria-label={`Delete ${b.name}`} onClick={() => setToDelete(b)} className="text-muted-foreground">
                      <Trash2 />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {archived.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-1 text-lg font-semibold tracking-tight">Archived boards</h2>
            <p className="mb-3 text-sm text-muted-foreground">Deleted boards move to the long-term archive after 30 days.</p>
            <ul className="grid gap-2">
              {archived.map((b) => (
                <li key={b.id} className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-muted-foreground">{b.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.daysLeft === 0 ? 'Removed soon' : `${b.daysLeft} day${b.daysLeft === 1 ? '' : 's'} left to restore`}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void onRestore(b)}><RotateCcw /> Restore</Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {purged.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-1 text-lg font-semibold tracking-tight">Long-term archive</h2>
            <p className="mb-3 text-sm text-muted-foreground">Retrieve a board to move it back to Archived boards, then restore it there.</p>
            <ul className="grid gap-2">
              {purged.map((b) => (
                <li key={b.id} className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-muted-foreground">{b.name}</p>
                    <p className="text-xs text-muted-foreground">Archived {new Date(b.purgedAt).toLocaleDateString()}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void onRestorePurged(b)}><RotateCcw /> Retrieve</Button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      {toDelete && (
        <ConfirmDialog
          title={`Delete "${toDelete.name}"?`}
          description="The board and everything on it will be deleted."
          confirmLabel="Delete board"
          onConfirm={() => void onDelete(toDelete)}
          onClose={() => setToDelete(null)}
        />
      )}
    </div>
  )
}
