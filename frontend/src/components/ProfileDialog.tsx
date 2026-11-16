// Profile dialog: change first/last name and profile picture, and switch between light and dark mode.
// Theme applies instantly (it is a browser preference kept in a cookie); name and picture are saved with the Save button.

import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { toast } from 'sonner'
import AvatarCropper from '@/components/AvatarCropper'
import UserAvatar from '@/components/UserAvatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useTheme } from '@/theme/theme-context'
import { api } from '../api/client'
import { useAuth, type User } from '../auth/auth-context'

const MAX_FILE_BYTES = 20 * 1024 * 1024 // source photos can be big; the cropped result is tiny

// What will happen to the picture on Save.
type AvatarChange = { kind: 'none' } | { kind: 'remove' } | { kind: 'set'; blob: Blob; previewUrl: string }

interface Props {
  user: User
  onClose: () => void
}

// The parent renders it only while open, so state resets each time.
export default function ProfileDialog({ user, onClose }: Props) {
  const { updateUser } = useAuth()
  const { theme, setTheme } = useTheme()
  const fileInput = useRef<HTMLInputElement>(null)
  const [firstName, setFirstName] = useState(user.firstName)
  const [lastName, setLastName] = useState(user.lastName)
  const [avatar, setAvatar] = useState<AvatarChange>({ kind: 'none' })
  // The picked file while the cropper is showing, else null.
  const [cropping, setCropping] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const hasSavedAvatar = !!user.avatarVersion
  // Preview: new picture, forced initials after Remove, or the saved one (undefined).
  const previewSrc = avatar.kind === 'set' ? avatar.previewUrl : avatar.kind === 'remove' ? null : undefined
  const showsPicture = avatar.kind === 'set' || (avatar.kind === 'none' && hasSavedAvatar)
  const nameChanged = firstName.trim() !== user.firstName || lastName.trim() !== user.lastName
  const dirty = nameChanged || avatar.kind !== 'none'

  function onFilePicked(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allows picking the same file again
    if (!file) return
    if (!file.type.startsWith('image/')) return void toast.error('Please choose an image file.')
    if (file.size > MAX_FILE_BYTES) return void toast.error('That image is too large (20 MB max).')
    setCropping(file)
  }

  function setNewPicture(blob: Blob) {
    if (avatar.kind === 'set') URL.revokeObjectURL(avatar.previewUrl)
    setAvatar({ kind: 'set', blob, previewUrl: URL.createObjectURL(blob) })
    setCropping(null)
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      // Each step is applied locally as soon as the server accepted it, so a later failure doesn't lose it.
      if (nameChanged) {
        const saved = await api.put<User>('/auth/me', { firstName: firstName.trim(), lastName: lastName.trim() })
        updateUser({ firstName: saved.firstName, lastName: saved.lastName })
      }
      if (avatar.kind === 'set') {
        const body = new FormData()
        body.append('file', avatar.blob, 'avatar')
        const saved = await api.put<{ avatarVersion: number }>('/auth/me/avatar', body)
        updateUser({ avatarVersion: saved.avatarVersion })
      } else if (avatar.kind === 'remove') {
        await api.delete('/auth/me/avatar')
        updateUser({ avatarVersion: null })
      }
      toast.success('Profile updated.')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save your profile.')
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{cropping ? 'Adjust photo' : 'Your profile'}</DialogTitle>
          <DialogDescription className="sr-only">Edit your name, picture and appearance.</DialogDescription>
        </DialogHeader>

        {cropping ? (
          <AvatarCropper file={cropping} onCancel={() => setCropping(null)} onDone={setNewPicture} onError={(m) => { toast.error(m); setCropping(null) }} />
        ) : (
          <form onSubmit={save} className="grid gap-4">
            <div className="flex items-center gap-4">
              <UserAvatar user={{ ...user, firstName, lastName }} src={previewSrc} className="size-16 text-lg" />
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>Change photo</Button>
                {showsPicture && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setAvatar(hasSavedAvatar ? { kind: 'remove' } : { kind: 'none' })}>Remove</Button>
                )}
              </div>
              <input ref={fileInput} type="file" accept="image/*" aria-label="Profile photo" className="hidden" onChange={onFilePicked} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="profile-first">First name</Label>
                <Input id="profile-first" required maxLength={100} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="profile-last">Last name</Label>
                <Input id="profile-last" required maxLength={100} value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="profile-email">Email</Label>
              <Input id="profile-email" value={user.email} readOnly disabled />
            </div>

            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <Label htmlFor="profile-dark">Dark mode</Label>
              <Switch id="profile-dark" checked={theme === 'dark'} onCheckedChange={(on) => setTheme(on ? 'dark' : 'light')} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={!dirty || saving || !firstName.trim() || !lastName.trim()}>Save</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
