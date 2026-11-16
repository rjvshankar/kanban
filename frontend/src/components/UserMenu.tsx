// Header button showing the user's avatar and first name; opens the profile dialog.

import { useState } from 'react'
import ProfileDialog from '@/components/ProfileDialog'
import UserAvatar from '@/components/UserAvatar'
import { useAuth } from '../auth/auth-context'

export default function ProfileButton({ showName = true }: { showName?: boolean }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  if (!user) return null

  return (
    <>
      <button
        type="button"
        aria-label="Open profile"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full py-0.5 pr-2 pl-0.5 text-sm text-muted-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <UserAvatar user={user} />
        {showName && user.firstName}
      </button>
      {open && <ProfileDialog user={user} onClose={() => setOpen(false)} />}
    </>
  )
}
