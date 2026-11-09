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
