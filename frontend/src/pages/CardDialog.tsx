// Modal dialog for viewing/editing one card (title, description, due date) or deleting it.
// Viewers see the fields disabled.

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Card } from '../api/types'

// The editable fields, in the shape the API's PATCH /cards/{id} expects.
export interface CardFields {
  title: string
  description: string | null
  dueDate: string | null
}

// Inputs: the card, whether the user may edit, and callbacks into the parent.
interface Props {
  card: Card
  canEdit: boolean
  onSave: (fields: CardFields) => Promise<void>
  onDelete: () => void
  onClose: () => void
}

// Renders the modal and the edit form; clicking outside or pressing Esc closes it.
export default function CardDialog({ card, canEdit, onSave, onDelete, onClose }: Props) {
  // Form field: title (starts from the card's current value).
  const [title, setTitle] = useState(card.title)
  // Form field: description ("" when the card has none).
  const [description, setDescription] = useState(card.description ?? '')
  // Form field: due date as "YYYY-MM-DD", or "".
  const [dueDate, setDueDate] = useState(card.dueDate ?? '')
  // True while saving, to disable the Save button.
  const [busy, setBusy] = useState(false)

  // Saves the edits; blank description/date are sent as null so the API clears them.
  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    await onSave({ title, description: description.trim() || null, dueDate: dueDate || null })
    setBusy(false)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{canEdit ? 'Edit card' : 'Card'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="card-title">Title</Label>
            <Input id="card-title" required maxLength={200} disabled={!canEdit} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="card-description">Description</Label>
            <Textarea id="card-description" rows={5} maxLength={4000} disabled={!canEdit} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="card-due">Due date</Label>
            <Input id="card-due" type="date" disabled={!canEdit} value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-fit" />
          </div>
          <DialogFooter className="sm:justify-between">
            {canEdit ? (
              <>
                <Button type="button" variant="destructive" onClick={onDelete}>Delete</Button>
                <Button type="submit" disabled={busy}>Save</Button>
              </>
            ) : (
              <Button type="button" variant="outline" onClick={onClose}>Close</Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
