// Members dialog (owners only): who is on the board, change roles, remove people, and add users by search.
// Includes a legend explaining what each role can do. Every change refetches the list and pings the page.

import { useCallback, useEffect, useState } from 'react'
import { UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { api } from '../api/client'
import type { Member, Role } from '../api/types'
import { useAuth } from '../auth/auth-context'
import { ROLE_INFO, ROLES } from '../lib/roles'

interface Props {
  boardId: number
  onChanged: () => void // tell the board page to refetch (our own role may have changed)
  onClose: () => void
}

const selectClass = 'h-8 rounded-md border bg-background px-2 text-sm capitalize'

function RoleSelect({ value, onChange, label }: { value: Role; onChange: (r: Role) => void; label: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as Role)} className={selectClass}>
      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
    </select>
  )
}

export default function MembersDialog({ boardId, onChanged, onClose }: Props) {
  const { user } = useAuth()
  const base = `/boards/${boardId}/members`
  const [members, setMembers] = useState<Member[] | null>(null)
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<Member[]>([])
  // Role chosen for each search result before adding; defaults to editor.
  const [newRole, setNewRole] = useState<Record<number, Role>>({})

  const loadMembers = useCallback(
    () => api.get<Member[]>(base).then(setMembers).catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load members.')),
    [base],
  )
  useEffect(() => { void loadMembers() }, [loadMembers])

  // Debounced search for users who aren't on the board yet. The server needs at least 2 characters.
  useEffect(() => {
    const q = term.trim()
    if (q.length < 2) return
    let cancelled = false
    const t = setTimeout(() => {
      api.get<Member[]>(`${base}/candidates?q=${encodeURIComponent(q)}`)
        .then((r) => { if (!cancelled) setResults(r) })
        .catch(() => { if (!cancelled) setResults([]) })
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [term, base, members]) // `members` changes after an add, so the added user drops out of the results

  // Results only count while the term is long enough (stale ones from a longer term are hidden).
  const searching = term.trim().length >= 2
  const shown = searching ? results : []

  // Runs a change, then refreshes the list and tells the board page.
  async function change(fn: () => Promise<unknown>) {
    try {
      await fn()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong.')
    }
    await loadMembers()
    onChanged()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Members</DialogTitle>
          <DialogDescription>Choose who can see and change this board.</DialogDescription>
        </DialogHeader>

        {/* Legend */}
        <dl className="grid gap-1 rounded-lg bg-muted p-3 text-xs">
          {ROLES.map((r) => (
            <div key={r} className="flex gap-2">
              <dt className="w-14 shrink-0 font-semibold capitalize">{r}</dt>
              <dd className="text-muted-foreground">{ROLE_INFO[r]}</dd>
            </div>
          ))}
        </dl>

        <ul className="grid gap-1">
          {members === null && <li className="text-sm text-muted-foreground">Loading...</li>}
          {members?.map((m) => {
            const isMe = m.userId === user?.id
            return (
              <li key={m.userId} className="flex items-center gap-2 rounded-md px-1 py-1">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.firstName} {m.lastName}{isMe && <span className="text-muted-foreground"> (you)</span>}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                </div>
                {/* Your own row is read-only here, so you can't lock yourself out by accident. */}
                {isMe ? (
                  <span className="pr-2 text-sm capitalize text-muted-foreground">{m.role}</span>
                ) : (
                  <>
                    <RoleSelect
                      label={`Role for ${m.firstName} ${m.lastName}`}
                      value={m.role as Role}
                      onChange={(role) => void change(() => api.patch(`${base}/${m.userId}`, { role }))}
                    />
                    <Button variant="ghost" size="icon-sm" aria-label={`Remove ${m.firstName} ${m.lastName}`} className="text-muted-foreground"
                      onClick={() => void change(() => api.delete(`${base}/${m.userId}`))}>
                      <X />
                    </Button>
                  </>
                )}
              </li>
            )
          })}
        </ul>

        <div className="grid gap-2 border-t pt-3">
          <p className="text-sm font-medium">Add people</p>
          <Input placeholder="Search by name or email" value={term} onChange={(e) => setTerm(e.target.value)} />
          {searching && shown.length === 0 && <p className="text-xs text-muted-foreground">No matching users.</p>}
          <ul className="grid gap-1">
            {shown.map((u) => (
              <li key={u.userId} className="flex items-center gap-2 rounded-md px-1 py-1">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{u.firstName} {u.lastName}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                </div>
                <RoleSelect
                  label={`Role for ${u.firstName} ${u.lastName}`}
                  value={newRole[u.userId] ?? 'editor'}
                  onChange={(r) => setNewRole((prev) => ({ ...prev, [u.userId]: r }))}
                />
                <Button size="sm" variant="outline"
                  onClick={() => void change(() => api.post(base, { userId: u.userId, role: newRole[u.userId] ?? 'editor' }))}>
                  <UserPlus /> Add
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  )
}
