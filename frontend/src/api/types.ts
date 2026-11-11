// TypeScript shapes of the JSON the API returns for boards, columns and cards.

// A user's role on a board; viewers are read-only.
export type Role = 'owner' | 'editor' | 'viewer'

// One row in the board list (no columns or cards).
export interface BoardSummary {
  id: number
  name: string
  role: Role
  createdAt: string
}

// A single card on a board.
export interface Card {
  id: number
  title: string
  description: string | null
  // Date only, formatted "YYYY-MM-DD" (no time or timezone).
  dueDate: string | null // "YYYY-MM-DD"
  // Sort key within the column; the API already returns cards ordered by it.
  position: number
}

// A column and the cards inside it, in display order.
export interface Column {
  id: number
  name: string
  position: number
  cards: Card[]
}

// A full board: details, the caller's role, and its columns with nested cards.
export interface Board {
  id: number
  name: string
  role: Role
  createdAt: string
  columns: Column[]
}

// A person on a board, as listed in the Members dialog (owners only). `role` is empty for search candidates.
export interface Member {
  userId: number
  firstName: string
  lastName: string
  email: string
  role: Role | ''
}

// A deleted board that can still be restored (owners only, until the purge window ends).
export interface PurgedBoard {
  id: number
  name: string
  purgedAt: string
}

export interface ArchivedBoard {
  id: number
  name: string
  deletedAt: string
  daysLeft: number
}
