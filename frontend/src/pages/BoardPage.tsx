// The board screen. Loads one board (columns + cards), renders it, and handles every edit,
// including drag and drop with dnd-kit.
//
// Data flow: the server is the source of truth. After every change we refetch the board.
// While dragging we work on a local copy (draft) so the UI moves instantly; the draft is
// discarded once the refetch lands, so a failed move snaps back to the server's order.
//
// DnD ids are strings: "col-<id>" for columns and "card-<id>" for cards.

import {
  closestCenter,
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, horizontalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError, api } from '../api/client'
import type { Board, Card, Column } from '../api/types'
import { cardBoxStyle, columnBoxStyle } from './board-styles'
import CardDialog, { type CardFields } from './CardDialog'
import { FormError } from './Form'
import { CardBody } from './SortableCard'
import SortableColumn from './SortableColumn'

// Builds a column's dnd id from its database id.
const colKey = (id: number) => `col-${id}`
// Extracts the database id from a dnd id ("card-7" -> 7).
const parseId = (key: string | number) => Number(String(key).split('-')[1])
// True if a dnd id belongs to a column (otherwise it is a card).
const isCol = (key: string | number) => String(key).startsWith('col-')

// Columns only collide with columns; cards prefer the card under the pointer, else the column.
const collisionDetection: CollisionDetection = (args) => {
  // Looks up whether a droppable is a "card" or a "column".
  const typeOf = (id: string | number) => args.droppableContainers.find((c) => c.id === id)?.data.current?.type

  if (args.active.data.current?.type === 'column') {
    return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => c.data.current?.type === 'column') })
  }
  // Droppables currently under the pointer.
  const hits = pointerWithin(args)
  if (hits.length === 0) return closestCorners(args)
  // Prefer a card over its parent column so dropping targets a specific position.
  const cardHit = hits.find((h) => typeOf(h.id) === 'card')
  return [cardHit ?? hits[0]]
}

// Board screen component.
export default function BoardPage() {
  // Board id from the URL (/boards/:id).
  const { id } = useParams()
  // The board as last loaded from the server; null until the first load.
  const [board, setBoard] = useState<Board | null>(null)
  const [draft, setDraft] = useState<Column[] | null>(null) // local copy while dragging / until the refetch lands
  // Dnd id of the item currently being dragged, or null; drives the drag preview.
  const [dragging, setDragging] = useState<string | null>(null)
  // True if the API says the board doesn't exist or isn't yours (404).
  const [notFound, setNotFound] = useState(false)
  // Bumping this re-runs the load effect, which is how we refetch.
  const [version, setVersion] = useState(0)
  // Error message to show above the columns, or null.
  const [error, setError] = useState<string | null>(null)
  // Form field: name of the column to add.
  const [newColumn, setNewColumn] = useState('')
  // The card open in the edit dialog, or null.
  const [editing, setEditing] = useState<Card | null>(null)

  // Input methods that can start a drag: mouse, touch and keyboard.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }), // small move = drag, plain click still opens a card
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Loads the board on mount and whenever the id or version changes.
  useEffect(() => {
    // Set by cleanup so a late response is ignored after unmount or navigation.
    let cancelled = false
    api
      .get<Board>(`/boards/${id}`)
      .then((b) => {
        if (cancelled) return
        setBoard(b)
        // Fresh server data replaces any local drag copy.
        setDraft(null)
      })
      .catch((e) => {
        if (cancelled) return
        if (e instanceof ApiError && e.status === 404) setNotFound(true)
        else setError(e instanceof Error ? e.message : 'Failed to load board.')
      })
    return () => {
      cancelled = true
    }
  }, [id, version])

  // Triggers a refetch of the board.
  const reload = () => setVersion((v) => v + 1)

  // Runs a mutation, shows any error, and refetches the board afterwards (which also clears any draft).
  async function run(fn: () => Promise<unknown>) {
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    }
    reload()
  }

  if (notFound) return <main style={{ padding: '1rem' }}><p>Board not found.</p><Link to="/">Back to boards</Link></main>
  if (!board) return <main style={{ padding: '1rem' }}><FormError message={error} /><p>Loading...</p></main>

  // Owners and editors can change the board; viewers are read-only.
  const canEdit = board.role !== 'viewer'
  // Columns to display: the local draft during/just after a drag, otherwise the server's.
  const cols = draft ?? board.columns

  // Finds the column in a list that currently contains the given card.
  const findCardColumn = (list: Column[], cardId: number) => list.find((c) => c.cards.some((x) => x.id === cardId))

  // Remembers what is being dragged and starts a local copy to modify while dragging.
  function onDragStart(e: DragStartEvent) {
    setDragging(String(e.active.id))
    setDraft(board!.columns)
  }

  // Cross-column card moves happen live in the draft; same-column reordering is handled by the sortable transforms.
  function onDragOver(e: DragOverEvent) {
    const { active, over } = e
    if (!over || isCol(active.id)) return
    // Database id of the card being dragged.
    const activeId = parseId(active.id)
    // Database id of the card or column it is hovering over.
    const overId = parseId(over.id)

    setDraft((prev) => {
      if (!prev) return prev
      // Column the card currently sits in.
      const from = findCardColumn(prev, activeId)
      // Column under the pointer (the hovered column, or the column of the hovered card).
      const to = isCol(over.id) ? prev.find((c) => c.id === overId) : findCardColumn(prev, overId)
      if (!from || !to || from.id === to.id) return prev

      // The card object being moved.
      const card = from.cards.find((c) => c.id === activeId)!
      // Current on-screen rectangle of the dragged card.
      const translated = active.rect.current.translated
      // True if the dragged card is past the hovered card's midpoint, so it should land after it.
      const below = !isCol(over.id) && translated ? translated.top > over.rect.top + over.rect.height / 2 : false
      // Index in the target column to insert at: the end for a column, next to the hovered card otherwise.
      const overIndex = isCol(over.id) ? to.cards.length : to.cards.findIndex((c) => c.id === overId) + (below ? 1 : 0)

      // Remove the card from its old column and insert it into the new one.
      return prev.map((c) => {
        if (c.id === from.id) return { ...c, cards: c.cards.filter((x) => x.id !== activeId) }
        if (c.id === to.id) return { ...c, cards: [...c.cards.slice(0, overIndex), card, ...c.cards.slice(overIndex)] }
        return c
      })
    })
  }

  // On drop: work out the final position and save it with one move request; refetch afterwards.
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    setDragging(null)
    // Dropped outside any target: discard the draft.
    if (!over || !draft) return setDraft(null)

    // Column drop: reorder columns and tell the API which column it now follows.
    if (isCol(active.id)) {
      // Old index of the dragged column.
      const from = draft.findIndex((c) => c.id === parseId(active.id))
      // Index of the column it was dropped on.
      const to = draft.findIndex((c) => c.id === parseId(over.id))
      if (from < 0 || to < 0 || from === to) return setDraft(null)

      // Columns in their new order.
      const next = arrayMove(draft, from, to)
      setDraft(next)
      void run(() => api.post(`/columns/${next[to].id}/move`, { afterColumnId: next[to - 1]?.id ?? null }))
      return
    }

    // Card drop: database id of the dragged card.
    const activeId = parseId(active.id)
    // Columns after applying the final reorder (cross-column moves are already in the draft).
    let next = draft
    // Column the card is currently in.
    const col = findCardColumn(next, activeId)
    if (!col) return setDraft(null)

    // Dropped on another card in the same column: reorder within the column.
    if (!isCol(over.id)) {
      const overId = parseId(over.id)
      // Where the card was in the column.
      const oldIndex = col.cards.findIndex((c) => c.id === activeId)
      // Where the card it was dropped on is.
      const newIndex = col.cards.findIndex((c) => c.id === overId)
      if (newIndex >= 0 && oldIndex !== newIndex) {
        next = next.map((c) => (c.id === col.id ? { ...c, cards: arrayMove(c.cards, oldIndex, newIndex) } : c))
      }
    }

    // Column the card ends up in.
    const finalCol = findCardColumn(next, activeId)!
    // Final index of the card within that column.
    const index = finalCol.cards.findIndex((c) => c.id === activeId)
    // Column the card was in before the drag, per the server data.
    const origCol = findCardColumn(board!.columns, activeId)
    // Dropped back where it started: nothing to save.
    if (origCol?.id === finalCol.id && origCol.cards.findIndex((c) => c.id === activeId) === index) return setDraft(null) // dropped where it started

    setDraft(next)
    // afterCardId is the card directly above the drop spot (null = top of the column).
    void run(() => api.post(`/cards/${activeId}/move`, { toColumnId: finalCol.id, afterCardId: finalCol.cards[index - 1]?.id ?? null }))
  }

  // Prompts for a new board name and saves it.
  function renameBoard() {
    // The new name, trimmed; empty if cancelled.
    const name = prompt('Board name', board!.name)?.trim()
    if (name && name !== board!.name) void run(() => api.patch(`/boards/${board!.id}`, { name }))
  }

  // Creates a column from the form input.
  function addColumn(e: FormEvent) {
    e.preventDefault()
    // Copy the value first, because the input is cleared on the next line.
    const name = newColumn
    setNewColumn('')
    void run(() => api.post(`/boards/${board!.id}/columns`, { name }))
  }

  // Prompts for a new column name and saves it.
  const renameColumn = (col: Column) => {
    const name = prompt('Column name', col.name)?.trim()
    if (name && name !== col.name) void run(() => api.patch(`/columns/${col.id}`, { name }))
  }

  // Confirms, then deletes the column (its cards go with it).
  const deleteColumn = (col: Column) => {
    if (confirm(`Delete column "${col.name}" and its cards?`)) void run(() => api.delete(`/columns/${col.id}`))
  }

  // The card being dragged, used for the drag preview.
  const activeCard = dragging && !isCol(dragging) ? cols.flatMap((c) => c.cards).find((c) => c.id === parseId(dragging)) : undefined
  // The column being dragged, used for the drag preview.
  const activeColumn = dragging && isCol(dragging) ? cols.find((c) => c.id === parseId(dragging)) : undefined

  return (
    <main style={{ padding: '1rem' }}>
      <header style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <Link to="/">&larr; Boards</Link>
        <h1 style={{ margin: 0 }}>{board.name}</h1>
        {canEdit && <button onClick={renameBoard}>Rename</button>}
        <small>{board.role}</small>
      </header>
      <FormError message={error} />

      {/* Drag-and-drop area: wires sensors, collision rules and the drag handlers. */}
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setDragging(null)
          setDraft(null)
        }}
      >
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', overflowX: 'auto', marginTop: '1rem' }}>
          {/* Makes the columns reorderable horizontally. */}
          <SortableContext items={cols.map((c) => colKey(c.id))} strategy={horizontalListSortingStrategy}>
            {cols.map((col) => (
              <SortableColumn
                key={col.id}
                column={col}
                canEdit={canEdit}
                onRename={() => renameColumn(col)}
                onDelete={() => deleteColumn(col)}
                onOpenCard={setEditing}
                onAddCard={(title) => run(() => api.post(`/columns/${col.id}/cards`, { title }))}
              />
            ))}
          </SortableContext>

          {canEdit && (
            <form onSubmit={addColumn} style={{ minWidth: 220 }}>
              <input placeholder="New column" required maxLength={200} value={newColumn} onChange={(e) => setNewColumn(e.target.value)} />
              <button type="submit">Add</button>
            </form>
          )}
        </div>

        {/* The floating preview that follows the pointer while dragging. */}
        <DragOverlay>
          {activeCard && <div style={{ ...cardBoxStyle, boxShadow: 'var(--shadow)' }}><CardBody card={activeCard} /></div>}
          {activeColumn && <div style={{ ...columnBoxStyle, boxShadow: 'var(--shadow)' }}><strong>{activeColumn.name}</strong> ({activeColumn.cards.length})</div>}
        </DragOverlay>
      </DndContext>

      {editing && (
        <CardDialog
          key={editing.id}
          card={editing}
          canEdit={canEdit}
          onClose={() => setEditing(null)}
          onSave={async (fields: CardFields) => {
            await run(() => api.patch(`/cards/${editing.id}`, fields))
            setEditing(null)
          }}
          onDelete={async () => {
            if (!confirm('Delete this card?')) return
            await run(() => api.delete(`/cards/${editing.id}`))
            setEditing(null)
          }}
        />
      )}
    </main>
  )
}
