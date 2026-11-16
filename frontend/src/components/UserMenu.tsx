// Header menu under the user's avatar and first name (same on every page so it never moves): Edit profile (opens the profile dialog), the dark mode switch and Log out.

import { useRef, useState } from 'react'
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

export default function UserMenu() {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  // Whether the profile dialog is open (rendered only while open so its form state resets each time).
  const [editing, setEditing] = useState(false)
  // True while the menu is closing to open the dialog: the menu must not hand focus back to its button then,
  // or the dialog's focus trap steals focus back mid-typing and selects the field's text.
  const openingDialog = useRef(false)
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
          {user.firstName}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-56"
          onCloseAutoFocus={(e) => {
            if (openingDialog.current) {
              e.preventDefault()
              openingDialog.current = false
            }
          }}
        >
          <DropdownMenuLabel className="font-normal">
            <div className="truncate text-sm font-medium text-foreground">{user.firstName} {user.lastName}</div>
            <div className="truncate text-xs text-muted-foreground">{user.email}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => {
            openingDialog.current = true
            setEditing(true)
          }}><UserPen /> Edit profile</DropdownMenuItem>
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
