export type Role = 'owner' | 'editor' | 'viewer'

export interface BoardSummary {
  id: number
  name: string
  role: Role
  createdAt: string
}

export interface Card {
  id: number
  title: string
  description: string | null
  dueDate: string | null // "YYYY-MM-DD"
  position: number
}

export interface Column {
  id: number
  name: string
  position: number
  cards: Card[]
}

export interface Board {
  id: number
  name: string
  role: Role
  createdAt: string
  columns: Column[]
}
