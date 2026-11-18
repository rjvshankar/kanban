// Stack of avatars for everyone viewing the board right now. You come first (ringed), the rest keep the server's order.

import { cn } from '@/lib/utils'
import { useAuth } from '../auth/auth-context'
import type { Viewer } from '../realtime/useBoardRealtime'
import UserAvatar from './UserAvatar'

// More viewers than this collapse into a "+N" bubble.
const MAX_SHOWN = 4

export default function PresenceAvatars({ viewers }: { viewers: Viewer[] }) {
  const { user } = useAuth()
  if (viewers.length === 0) return null

  const ordered = [...viewers.filter((v) => v.id === user?.id), ...viewers.filter((v) => v.id !== user?.id)]
  const shown = ordered.slice(0, MAX_SHOWN)
  const hidden = ordered.slice(MAX_SHOWN)

  return (
    <ul aria-label="People viewing this board" className="flex -space-x-2">
      {shown.map((v) => {
        const you = v.id === user?.id
        const name = `${v.firstName} ${v.lastName}`
        return (
          <li key={v.id} title={you ? `${name} (you)` : name} aria-label={you ? `${name} (you)` : name}>
            <UserAvatar user={v} className={cn('ring-2 ring-background', you && 'ring-primary')} />
          </li>
        )
      })}
      {hidden.length > 0 && (
        <li
          title={hidden.map((v) => `${v.firstName} ${v.lastName}`).join(', ')}
          aria-label={`${hidden.length} more`}
          className="inline-flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground ring-2 ring-background"
        >
          +{hidden.length}
        </li>
      )}
    </ul>
  )
}
