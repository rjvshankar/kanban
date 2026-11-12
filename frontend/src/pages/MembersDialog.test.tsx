import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import type { Member } from '../api/types'
import { server } from '../test/server'
import { http, HttpResponse, renderWithProviders, url } from '../test/utils'
import MembersDialog from './MembersDialog'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const me: Member = { userId: 1, firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', role: 'owner' }
const bob: Member = { userId: 2, firstName: 'Bob', lastName: 'Builder', email: 'bob@example.com', role: 'editor' }
const carol: Member = { userId: 3, firstName: 'Carol', lastName: 'Candidate', email: 'carol@example.com', role: '' }

/** Serves the members list from mutable data and records every request that changes it. */
function serve(members: Member[] = [me, bob], candidates: Member[] = [carol]) {
  const state = { members, writes: [] as string[], searches: [] as string[] }
  server.use(
    http.get(url('/boards/5/members'), () => HttpResponse.json(state.members)),
    http.get(url('/boards/5/members/candidates'), ({ request }) => {
      state.searches.push(new URL(request.url).searchParams.get('q')!)
      return HttpResponse.json(candidates.filter((c) => !state.members.some((m) => m.userId === c.userId))) // like the API: members are not candidates
    }),
  )
  return state
}

const mount = () => {
  const onChanged = vi.fn(); const onClose = vi.fn()
  return { onChanged, onClose, ...renderWithProviders(<MembersDialog boardId={5} onChanged={onChanged} onClose={onClose} />) }
}

describe('MembersDialog', () => {
  it('lists members and explains each role', async () => {
    serve()
    mount()

    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(await screen.findByText('Bob Builder')).toBeInTheDocument()
    expect(screen.getByText('bob@example.com')).toBeInTheDocument()
    const legend = screen.getByText(/Everything: manage columns/i).closest('dl')!
    expect(within(legend).getByText('editor')).toBeInTheDocument()
    expect(within(legend).getByText('viewer')).toBeInTheDocument()
  })

  it('shows the current user as read-only so they cannot lock themselves out', async () => {
    serve()
    mount()
    await screen.findByText('Bob Builder')

    expect(screen.getByText('(you)')).toBeInTheDocument()
    expect(screen.queryByLabelText('Role for Ada Lovelace')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Remove Ada Lovelace')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Role for Bob Builder')).toHaveValue('editor')
  })

  it('changes a role, refreshes the list and tells the board page', async () => {
    const state = serve()
    server.use(http.patch(url('/boards/5/members/2'), async ({ request }) => {
      const { role } = (await request.json()) as { role: Member['role'] }
      state.writes.push(`PATCH ${role}`); state.members = [me, { ...bob, role }]
      return new HttpResponse(null, { status: 204 })
    }))
    const { user, onChanged } = mount()

    await user.selectOptions(await screen.findByLabelText('Role for Bob Builder'), 'viewer')

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
    expect(state.writes).toEqual(['PATCH viewer'])
    expect(screen.getByLabelText('Role for Bob Builder')).toHaveValue('viewer')
  })

  it('removes a member', async () => {
    const state = serve()
    server.use(http.delete(url('/boards/5/members/2'), () => { state.writes.push('DELETE'); state.members = [me]; return new HttpResponse(null, { status: 204 }) }))
    const { user, onChanged } = mount()

    await user.click(await screen.findByLabelText('Remove Bob Builder'))

    await waitFor(() => expect(screen.queryByText('Bob Builder')).not.toBeInTheDocument())
    expect(state.writes).toEqual(['DELETE'])
    expect(onChanged).toHaveBeenCalled()
  })

  it('toasts a failed change, still refreshes and still notifies', async () => {
    serve()
    server.use(http.delete(url('/boards/5/members/2'), () => HttpResponse.json({ error: 'A board needs at least one owner.' }, { status: 409 })))
    const { user, onChanged } = mount()

    await user.click(await screen.findByLabelText('Remove Bob Builder'))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('A board needs at least one owner.'))
    expect(onChanged).toHaveBeenCalled()
    expect(screen.getByText('Bob Builder')).toBeInTheDocument()
  })

  it('toasts when the list cannot be loaded', async () => {
    server.use(http.get(url('/boards/5/members'), () => HttpResponse.json({ error: 'Forbidden.' }, { status: 403 })))
    mount()
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Forbidden.'))
  })

  describe('adding people', () => {
    it('does not search until two characters are typed', async () => {
      const state = serve()
      const { user } = mount()
      await screen.findByText('Bob Builder')

      await user.type(screen.getByPlaceholderText('Search by name or email'), 'c')
      await new Promise((r) => setTimeout(r, 350)) // longer than the debounce

      expect(state.searches).toEqual([])
      expect(screen.queryByText('No matching users.')).not.toBeInTheDocument()
    })

    it('searches after a pause with the trimmed term and lists candidates', async () => {
      const state = serve()
      const { user } = mount()
      await screen.findByText('Bob Builder')

      await user.type(screen.getByPlaceholderText('Search by name or email'), ' ca ')

      expect(await screen.findByText('Carol Candidate')).toBeInTheDocument()
      expect(state.searches).toEqual(['ca']) // one request, not one per keystroke
    })

    it('says when nobody matches', async () => {
      serve([me, bob], [])
      const { user } = mount()
      await screen.findByText('Bob Builder')

      await user.type(screen.getByPlaceholderText('Search by name or email'), 'zz')

      expect(await screen.findByText('No matching users.')).toBeInTheDocument()
    })

    it('adds a candidate as editor by default', async () => {
      const state = serve()
      let body: unknown
      server.use(http.post(url('/boards/5/members'), async ({ request }) => {
        body = await request.json(); state.members = [me, bob, { ...carol, role: 'editor' }]
        return new HttpResponse(null, { status: 204 })
      }))
      const { user, onChanged } = mount()
      await screen.findByText('Bob Builder')

      await user.type(screen.getByPlaceholderText('Search by name or email'), 'ca')
      await user.click(await screen.findByRole('button', { name: /add/i }))

      await waitFor(() => expect(body).toEqual({ userId: 3, role: 'editor' }))
      await waitFor(() => expect(onChanged).toHaveBeenCalled())
      expect(await screen.findByLabelText('Role for Carol Candidate')).toHaveValue('editor') // now a member
    })

    it('adds with the role picked beforehand', async () => {
      serve()
      let body: unknown
      server.use(http.post(url('/boards/5/members'), async ({ request }) => { body = await request.json(); return new HttpResponse(null, { status: 204 }) }))
      const { user } = mount()
      await screen.findByText('Bob Builder')

      await user.type(screen.getByPlaceholderText('Search by name or email'), 'ca')
      await user.selectOptions(await screen.findByLabelText('Role for Carol Candidate'), 'viewer')
      await user.click(screen.getByRole('button', { name: /add/i }))

      await waitFor(() => expect(body).toEqual({ userId: 3, role: 'viewer' }))
    })
  })

  it('closes with Escape', async () => {
    serve()
    const { user, onClose } = mount()
    await screen.findByText('Bob Builder')
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
})
