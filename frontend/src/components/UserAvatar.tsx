// Round avatar: the user's uploaded picture, or their initials when there is none (or it fails to load).

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { User } from '../auth/auth-context'

interface Props {
  user: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarVersion'>
  className?: string
  // Overrides the server picture: a URL to preview, or null to force initials. Omit to use the saved picture.
  src?: string | null
}

export default function UserAvatar({ user, className, src }: Props) {
  // Set when the image request fails, so we fall back to initials instead of a broken icon.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const url = src !== undefined ? src : user.avatarVersion ? `/api/users/${user.id}/avatar?v=${user.avatarVersion}` : null
  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()

  return (
    <span className={cn('inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-medium text-muted-foreground', className)}>
      {url && url !== failedSrc ? (
        <img src={url} alt="" className="size-full object-cover" onError={() => setFailedSrc(url)} />
      ) : (
        <span aria-hidden>{initials}</span>
      )}
    </span>
  )
}
