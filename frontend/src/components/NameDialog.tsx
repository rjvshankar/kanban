// Small modal with one text field, used for naming/renaming boards and columns
// (replaces the browser's prompt()). Mount it to open it; call onClose to dismiss.

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface Props {
  title: string
  initial: string
  onSubmit: (name: string) => void
  onClose: () => void
}

// Dialog with a single input. The parent renders it only while it should be open, so state resets each time.
export default function NameDialog({ title, initial, onSubmit, onClose }: Props) {
  // Current text in the input.
  const [name, setName] = useState(initial)

  // Submits the trimmed name (ignoring blanks) and closes.
  function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <Input autoFocus required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
