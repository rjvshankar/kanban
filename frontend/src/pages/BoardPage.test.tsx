import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import type { Board, Role } from '../api/types'
import { useBoardRealtime } from '../realtime/useBoardRealtime'
import { server } from '../test/server'
import { http, HttpResponse, makeBoard, renderWithProviders, url } from '../test/utils'
import BoardPage from './BoardPage'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('../realtime/useBoardRealtime', () => ({ useBoardRealtime: vi.fn() }))

interface Writes { method: string; path: string; body: unknown }

/** Serves GET /boards/5 from mutable data, counts loads, and records every write the page makes. */
function serve(role: Role = 'owner', overrides: Partial<Board> = {}) {
  const state = { board: makeBoard(role, overrides), loads: 0, writes: [] as Writes[] }
  const record = (method: string) => async ({ request }: { request: Request }) => {
    const text = await request.text()
    state.writes.push({ method, path: new URL(request.url).pathname.replace('/api', ''), body: text ? JSON.parse(text) : undefined })
    return new HttpResponse(null, { status: 204 })
  }
  server.use(
    http.get(url('/boards/5'), () => { state.loads++; return HttpResponse.json(state.board) }),
    http.post(url('/boards/5/columns'), async (ctx) => { await record('POST')(ctx); return HttpResponse.json({ id: 99 }, { status: 201 }) }),
    http.post(url('/columns/:id/cards'), async (ctx) => { await record('POST')(ctx); return HttpResponse.json({ id: 99 }, { status: 201 }) }),
    http.patch(url('/boards/5'), record('PATCH')),
    http.patch(url('/columns/:id'), record('PATCH')),
    http.patch(url('/cards/:id'), record('PATCH')),
    http.delete(url('/columns/:id'), record('DELETE')),
    http.delete(url('/cards/:id'), record('DELETE')),
  )
  return state
}

const mount = () => renderWithProviders(<BoardPage />, { route: '/boards/5', path: '/boards/:id' })

beforeEach(() => vi.mocked(useBoardRealtime).mockReset())

describe('BoardPage: loading', () => {
  it('shows loading, then the board with its columns, cards, counts and due dates', async () => {
    serve()
    mount()

    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Roadmap' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'To do' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Done' })).toBeInTheDocument()
    expect(screen.getByText('Write tests')).toBeInTheDocument()
    expect(screen.getByText('Ship it')).toBeInTheDocument()
    expect(screen.getByText('2030-05-06')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // card count of "To do"
    expect(screen.getByText('owner')).toBeInTheDocument()
  })

  it('subscribes to live updates for this board', async () => {
    serve()
    mount()
    await screen.findByText('Roadmap')
    expect(vi.mocked(useBoardRealtime).mock.calls.at(-1)![0]).toBe(5)
  })

  it('shows "Board not found" with a way back for a 404', async () => {
    server.use(http.get(url('/boards/5'), () => HttpResponse.json({}, { status: 404 })))
    mount()

    expect(await screen.findByText('Board not found.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to boards' })).toHaveAttribute('href', '/')
  })

  it('shows the error message when loading fails otherwise', async () => {
    server.use(http.get(url('/boards/5'), () => HttpResponse.json({ error: 'Database down.' }, { status: 500 })))
    mount()
    expect(await screen.findByText('Database down.')).toBeInTheDocument()
  })

  it('refetches when a live update arrives', async () => {
    const state = serve()
    mount()
    await screen.findByText('Roadmap')
    expect(state.loads).toBe(1)

    state.board = makeBoard('owner', { name: 'Renamed elsewhere' })
    vi.mocked(useBoardRealtime).mock.calls.at(-1)![1]()

    expect(await screen.findByRole('heading', { name: 'Renamed elsewhere' })).toBeInTheDocument()
    expect(state.loads).toBe(2)
  })
})

describe('BoardPage: what each role sees', () => {
  const ownerOnly = () => [
    screen.queryByLabelText('Rename board'),
    screen.queryByRole('button', { name: /members/i }),
    screen.queryByPlaceholderText('New column'),
    screen.queryAllByLabelText('Rename column')[0] ?? null,
    screen.queryAllByLabelText('Delete column')[0] ?? null,
    screen.queryAllByLabelText('Drag column')[0] ?? null,
  ]

  it('owner gets everything', async () => {
    serve('owner')
    mount()
    await screen.findByText('Roadmap')

    ownerOnly().forEach((el) => expect(el).toBeInTheDocument())
    expect(screen.getAllByPlaceholderText('Add a card')).toHaveLength(2)
  })

  it('editor can work with cards but not columns, settings or members', async () => {
    serve('editor')
    mount()
    await screen.findByText('Roadmap')

    ownerOnly().forEach((el) => expect(el).not.toBeInTheDocument())
    expect(screen.getAllByPlaceholderText('Add a card')).toHaveLength(2)
    expect(screen.getByText('editor')).toBeInTheDocument()
  })

  it('viewer is read-only', async () => {
    serve('viewer')
    mount()
    await screen.findByText('Roadmap')

    ownerOnly().forEach((el) => expect(el).not.toBeInTheDocument())
    expect(screen.queryByPlaceholderText('Add a card')).not.toBeInTheDocument()
    expect(screen.getByText('viewer')).toBeInTheDocument()
  })
})

describe('BoardPage: editing', () => {
  it('adds a card to the right column and refetches', async () => {
    const state = serve('editor')
    const { user } = mount()
    await screen.findByText('Roadmap')

    await user.type(screen.getAllByPlaceholderText('Add a card')[1], 'New card') // the "Done" column
    await user.click(screen.getAllByRole('button', { name: 'Add card' })[1])

    await waitFor(() => expect(state.loads).toBe(2))
    expect(state.writes).toEqual([{ method: 'POST', path: '/columns/11/cards', body: { title: 'New card' } }])
  })

  it('adds a column', async () => {
    const state = serve()
    const { user } = mount()
    await screen.findByText('Roadmap')

    await user.type(screen.getByPlaceholderText('New column'), 'Review')
    await user.click(screen.getByRole('button', { name: 'Add column' }))

    await waitFor(() => expect(state.loads).toBe(2))
    expect(state.writes).toEqual([{ method: 'POST', path: '/boards/5/columns', body: { name: 'Review' } }])
    expect(screen.getByPlaceholderText('New column')).toHaveValue('')
  })

  it('renames the board', async () => {
    const state = serve()
    const { user } = mount()
    await screen.findByText('Roadmap')

    await user.click(screen.getByLabelText('Rename board'))
    const input = within(screen.getByRole('dialog', { name: 'Rename board' })).getByRole('textbox')
    expect(input).toHaveValue('Roadmap')
    await user.clear(input)
    await user.type(input, 'Q3 plan')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(state.loads).toBe(2))
    expect(state.writes).toEqual([{ method: 'PATCH', path: '/boards/5', body: { name: 'Q3 plan' } }])
  })

  it('does not call the API when a rename keeps the same name', async () => {
    const state = serve()
    const { user } = mount()
    await screen.findByText('Roadmap')

    await user.click(screen.getAllByLabelText('Rename column')[0])
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(state.writes).toEqual([])
  })

  it('renames a column', async () => {
    const state = serve()
    const { user } = mount()
    await screen.findByText('Roadmap')

    await user.click(screen.getAllByLabelText('Rename column')[0])
    const input = within(screen.getByRole('dialog', { name: 'Rename column' })).getByRole('textbox')
    expect(input).toHaveValue('To do')
    await user.clear(input)
    await user.type(input, 'Backlog')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(state.writes).toEqual([{ method: 'PATCH', path: '/columns/10', body: { name: 'Backlog' } }]))
  })

  it('deletes a column only after confirmation', async () => {
    const state = serve()
    const { user } = mount()
    await screen.findByText('Roadmap')

    await user.click(screen.getAllByLabelText('Delete column')[1])
    expect(screen.getByText('Delete "Done"?')).toBeInTheDocument()
    expect(state.writes).toEqual([])
    await user.click(screen.getByRole('button', { name: 'Delete column' }))

    await waitFor(() => expect(state.writes).toEqual([{ method: 'DELETE', path: '/columns/11', body: undefined }]))
  })

  it('cancelling the delete confirmation changes nothing', async () => {
    const state = serve()
    const { user } = mount()
    await screen.findByText('Roadmap')

    await user.click(screen.getAllByLabelText('Delete column')[0])
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(state.writes).toEqual([])
  })

  it('toasts a failed change and still refetches so the page matches the server', async () => {
    const state = serve()
    server.use(http.post(url('/boards/5/columns'), () => HttpResponse.json({ error: 'Nope.' }, { status: 403 })))
    const { user } = mount()
    await screen.findByText('Roadmap')

    await user.type(screen.getByPlaceholderText('New column'), 'X')
    await user.click(screen.getByRole('button', { name: 'Add column' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Nope.'))
    await waitFor(() => expect(state.loads).toBe(2))
  })
})

describe('BoardPage: card dialog', () => {
  it('opens a card, saves edits and closes', async () => {
    const state = serve('editor')
    const { user } = mount()
    await screen.findByText('Roadmap')

    await user.click(screen.getByText('Write tests'))
    const dialog = screen.getByRole('dialog', { name: 'Edit card' })
    expect(within(dialog).getByLabelText('Title')).toHaveValue('Write tests')
    await user.clear(within(dialog).getByLabelText('Title'))
    await user.type(within(dialog).getByLabelText('Title'), 'Write more tests')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(state.writes).toEqual([
      { method: 'PATCH', path: '/cards/100', body: { title: 'Write more tests', description: 'All of them', dueDate: '2030-05-06' } },
    ]))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('deletes a card via the confirmation dialog', async () => {
    const state = serve('editor')
    const { user } = mount()
    await screen.findByText('Roadmap')

    await user.click(screen.getByText('Ship it'))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Delete "Ship it"?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete card' }))

    await waitFor(() => expect(state.writes).toEqual([{ method: 'DELETE', path: '/cards/101', body: undefined }]))
  })

  it('opens read-only for viewers', async () => {
    const state = serve('viewer')
    const { user } = mount()
    await screen.findByText('Roadmap')

    await user.click(screen.getByText('Write tests'))

    const dialog = screen.getByRole('dialog', { name: 'Card' })
    expect(within(dialog).getByLabelText('Title')).toBeDisabled()
    expect(within(dialog).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(state.writes).toEqual([])
  })
})

describe('BoardPage: members', () => {
  it('owners can open the members dialog', async () => {
    serve('owner')
    server.use(http.get(url('/boards/5/members'), () => HttpResponse.json([{ userId: 1, firstName: 'Ada', lastName: 'Lovelace', email: 'a@x.io', role: 'owner' }])))
    const { user } = mount()
    await screen.findByText('Roadmap')

    await user.click(screen.getByRole('button', { name: /members/i }))

    expect(await screen.findByRole('dialog', { name: 'Members' })).toBeInTheDocument()
  })
})
