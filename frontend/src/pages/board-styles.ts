// Style objects shared by the real cards/columns and their drag previews, so both look identical.

import type { CSSProperties } from 'react'

// Look of a card box.
export const cardBoxStyle: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '0.4rem',
  marginBottom: '0.4rem',
  background: 'var(--bg)',
  cursor: 'grab',
  listStyle: 'none',
}

// Look of a column box (fixed width so columns line up in a row).
export const columnBoxStyle: CSSProperties = {
  minWidth: 260,
  width: 260,
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.5rem',
  background: 'var(--bg)',
}
