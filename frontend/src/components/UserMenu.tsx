// Header menu under the user's avatar: Edit profile (opens the profile dialog), the dark mode switch and Log out.

import { useState } from 'react'
import { LogOut, UserPen } from 'lucide-react'
import ProfileDialog from '@/components/ProfileDialog'
import UserAvatar from '@/components/UserAvatar'
import { Switch } from '@/components/ui/switch'
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTheme } from '@/theme/theme-context'
import { useAuth } from '../auth/auth-context'

export default function UserMenu({ showName = true }: { showName?: boolean }) {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  // Whether the profile dialog is open (rendered only while open so its form state resets each time).
  const [editing, setEditing] = useState(false)
  if (!user) return null

  const dark = theme === 'dark'

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Account menu"
          className="flex items-center gap-2 rounded-full py-0.5 pr-2 pl-0.5 text-sm text-muted-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-[state=open]:bg-muted"
        >
          <UserAvatar user={user} />
          {showName && user.firstName}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="truncate text-sm font-medium text-foreground">{user.firstName} {user.lastName}</div>
            <div className="truncate text-xs text-muted-foreground">{user.email}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setEditing(true)}><UserPen /> Edit profile</DropdownMenuItem>
          {/* A checkbox item so it is announced as a toggle; preventDefault keeps the menu open so the change is visible. */}
          <DropdownMenuCheckboxItem
            checked={dark}
            onCheckedChange={(on) => setTheme(on ? 'dark' : 'light')}
            onSelect={(e) => e.preventDefault()}
            className="justify-between pr-1.5 [&>span:first-child]:hidden"
          >
            Dark mode
            <Switch checked={dark} tabIndex={-1} aria-hidden className="pointer-events-none" />
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void logout()}><LogOut /> Log out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {editing && <ProfileDialog user={user} onClose={() => setEditing(false)} />}
    </>
  )
}
