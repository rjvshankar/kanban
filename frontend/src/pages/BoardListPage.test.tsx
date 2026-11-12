import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import type { ArchivedBoard, BoardSummary, PurgedBoard } from '../api/types'
import { server } from '../test/server'
import { ada, http, HttpResponse, renderWithProviders, url } from '../test/utils'
import BoardListPage from './BoardListPage'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const board = (id: number, name: string, role: BoardSummary['role'] = 'owner'): BoardSummary => ({ id, name, role, createdAt: '2026-01-01T00:00:00Z' })

interface Data { boards: BoardSummary[]; archived: ArchivedBoard[]; purged: PurgedBoard[] }

/** Serves the three list endpoints from mutable data and counts how often the main list was loaded. */
function serve(initial: Partial<Data> = {}) {
  const data: Data = { boards: [], archived: [], purged: [], ...initial }
  const calls = { loads: 0 }
  server.use(
    http.get(url('/boards'), () => { calls.loads++; return HttpResponse.json(data.boards) }),
    http.get(url('/boards/archived'), () => HttpResponse.json(data.archived)),
    http.get(url('/boards/purged'), () => HttpResponse.json(data.purged)),
  )
  return { data, calls }
}

const mount = (auth = {}) => renderWithProviders(<BoardListPage />, { route: '/', path: '/', auth })

describe('BoardListPage', () => {
  it('greets the user, shows a loading state, then lists boards with their roles as links', async () => {
    serve({ boards: [board(5, 'Roadmap'), board(6, 'Shared', 'viewer')] })
    mount()

    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Roadmap' })).toHaveAttribute('href', '/boards/5')
    expect(screen.getByRole('link', { name: 'Shared' })).toHaveAttribute('href', '/boards/6')
    expect(screen.getByText(ada.firstName)).toBeInTheDocument()
    expect(screen.getByText('owner')).toBeInTheDocument()
    expect(screen.getByText('viewer')).toBeInTheDocument()
  })

  it('shows an empty state', async () => {
    serve()
    mount()
    expect(await screen.findByText('No boards yet. Create one above.')).toBeInTheDocument()
  })

  it('reports a failed load with a toast', async () => {
    server.use(
      http.get(url('/boards'), () => HttpResponse.json({ error: 'Database down.' }, { status: 500 })),
      http.get(url('/boards/archived'), () => HttpResponse.json([])),
      http.get(url('/boards/purged'), () => HttpResponse.json([])),
    )
    mount()
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Database down.'))
  })

  it('still shows boards when the archive lists fail to load', async () => {
    server.use(
      http.get(url('/boards'), () => HttpResponse.json([board(5, 'Roadmap')])),
      http.get(url('/boards/archived'), () => HttpResponse.json({ error: 'x' }, { status: 500 })),
      http.get(url('/boards/purged'), () => HttpResponse.json({ error: 'x' }, { status: 500 })),
    )
    mount()
    expect(await screen.findByText('Roadmap')).toBeInTheDocument()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('logs out', async () => {
    serve()
    const logout = vi.fn().mockResolvedValue(undefined)
    const { user } = mount({ logout })
    await user.click(await screen.findByRole('button', { name: /log out/i }))
    expect(logout).toHaveBeenCalled()
  })

  describe('creating', () => {
    it('posts the name, clears the input and reloads the list', async () => {
      const { data, calls } = serve()
      let body: unknown
      server.use(http.post(url('/boards'), async ({ request }) => {
        body = await request.json(); data.boards.push(board(9, 'New one')); return HttpResponse.json({ id: 9 }, { status: 201 })
      }))
      const { user } = mount()
      await screen.findByText('No boards yet. Create one above.')

      await user.type(screen.getByPlaceholderText('New board name'), 'New one')
      await user.click(screen.getByRole('button', { name: /create/i }))

      expect(await screen.findByRole('link', { name: 'New one' })).toBeInTheDocument()
      expect(body).toEqual({ name: 'New one' })
      expect(screen.getByPlaceholderText('New board name')).toHaveValue('')
      expect(calls.loads).toBe(2)
    })

    it('shows a toast and keeps the text when creating fails', async () => {
      serve()
      server.use(http.post(url('/boards'), () => HttpResponse.json({ error: 'Nope.' }, { status: 400 })))
      const { user } = mount()
      await screen.findByText('No boards yet. Create one above.')

      await user.type(screen.getByPlaceholderText('New board name'), 'X')
      await user.click(screen.getByRole('button', { name: /create/i }))

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Nope.'))
      expect(screen.getByPlaceholderText('New board name')).toHaveValue('X')
    })
  })

  describe('deleting', () => {
    it('is offered to owners only', async () => {
      serve({ boards: [board(5, 'Mine'), board(6, 'Theirs', 'editor'), board(7, 'Read only', 'viewer')] })
      mount()
      await screen.findByText('Mine')

      expect(screen.getByLabelText('Delete Mine')).toBeInTheDocument()
      expect(screen.queryByLabelText('Delete Theirs')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Delete Read only')).not.toBeInTheDocument()
    })

    it('asks for confirmation, then deletes and reloads', async () => {
      const { data, calls } = serve({ boards: [board(5, 'Roadmap')] })
      let deleted = false
      server.use(http.delete(url('/boards/5'), () => { deleted = true; data.boards = []; return new HttpResponse(null, { status: 204 }) }))
      const { user } = mount()

      await user.click(await screen.findByLabelText('Delete Roadmap'))
      expect(deleted).toBe(false)
      const dialog = screen.getByRole('alertdialog')
      expect(within(dialog).getByText('Delete "Roadmap"?')).toBeInTheDocument()
      await user.click(within(dialog).getByRole('button', { name: 'Delete board' }))

      expect(await screen.findByText('No boards yet. Create one above.')).toBeInTheDocument()
      expect(deleted).toBe(true)
      expect(calls.loads).toBe(2)
    })

    it('cancel leaves the board alone', async () => {
      serve({ boards: [board(5, 'Roadmap')] })
      const { user } = mount() // an unexpected DELETE would fail the test (no handler)
      await user.click(await screen.findByLabelText('Delete Roadmap'))
      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(screen.getByText('Roadmap')).toBeInTheDocument()
    })

    it('toasts when the delete fails', async () => {
      serve({ boards: [board(5, 'Roadmap')] })
      server.use(http.delete(url('/boards/5'), () => HttpResponse.json({ error: 'Forbidden.' }, { status: 403 })))
      const { user } = mount()
      await user.click(await screen.findByLabelText('Delete Roadmap'))
      await user.click(screen.getByRole('button', { name: 'Delete board' }))

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Forbidden.'))
    })
  })

  describe('archived boards', () => {
    const archived = (id: number, name: string, daysLeft: number): ArchivedBoard => ({ id, name, deletedAt: '2026-01-01T00:00:00Z', daysLeft })

    it('is hidden when there is nothing archived', async () => {
      serve({ boards: [board(5, 'Roadmap')] })
      mount()
      await screen.findByText('Roadmap')
      expect(screen.queryByText('Archived boards')).not.toBeInTheDocument()
    })

    it('shows how long each board can still be restored', async () => {
      serve({ archived: [archived(1, 'A', 12), archived(2, 'B', 1), archived(3, 'C', 0)] })
      mount()

      expect(await screen.findByText('12 days left to restore')).toBeInTheDocument()
      expect(screen.getByText('1 day left to restore')).toBeInTheDocument()
      expect(screen.getByText('Removed soon')).toBeInTheDocument()
    })

    it('restores a board, confirms with a toast and reloads', async () => {
      const { data, calls } = serve({ archived: [archived(1, 'Old plan', 12)] })
      server.use(http.post(url('/boards/1/restore'), () => {
        data.archived = []; data.boards = [board(1, 'Old plan')]; return new HttpResponse(null, { status: 204 })
      }))
      const { user } = mount()

      await user.click(await screen.findByRole('button', { name: /restore/i }))

      expect(await screen.findByRole('link', { name: 'Old plan' })).toBeInTheDocument()
      expect(toast.success).toHaveBeenCalledWith('Restored "Old plan".')
      expect(calls.loads).toBe(2)
    })

    it('reports a failed restore and reloads anyway', async () => {
      const { calls } = serve({ archived: [archived(1, 'Old plan', 12)] })
      server.use(http.post(url('/boards/1/restore'), () => HttpResponse.json({ error: 'Too late.' }, { status: 404 })))
      const { user } = mount()

      await user.click(await screen.findByRole('button', { name: /restore/i }))

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Too late.'))
      await waitFor(() => expect(calls.loads).toBe(2))
    })
  })

  describe('long-term archive', () => {
    const purged: PurgedBoard = { id: 8, name: 'Ancient', purgedAt: '2025-06-01T00:00:00Z' }

    it('lists purged boards and retrieves one back into Archived boards', async () => {
      const { data, calls } = serve({ purged: [purged] })
      server.use(http.post(url('/boards/8/restore-purged'), () => {
        data.purged = []; data.archived = [{ id: 8, name: 'Ancient', deletedAt: '2026-01-01T00:00:00Z', daysLeft: 30 }]
        return new HttpResponse(null, { status: 204 })
      }))
      const { user } = mount()

      expect(await screen.findByText('Long-term archive')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: /retrieve/i }))

      expect(await screen.findByText('30 days left to restore')).toBeInTheDocument()
      expect(toast.success).toHaveBeenCalledWith('"Ancient" moved to Archived boards. Restore it from there.')
      expect(calls.loads).toBe(2)
      expect(screen.queryByText('Long-term archive')).not.toBeInTheDocument()
    })

    it('toasts when retrieving fails', async () => {
      serve({ purged: [purged] })
      server.use(http.post(url('/boards/8/restore-purged'), () => HttpResponse.json({ error: 'Not yours.' }, { status: 404 })))
      const { user } = mount()

      await user.click(await screen.findByRole('button', { name: /retrieve/i }))

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Not yours.'))
    })
  })
})
