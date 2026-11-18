import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ada, renderWithProviders } from '../test/utils'
import PresenceAvatars from './PresenceAvatars'

const person = (id: number, firstName: string) => ({ id, firstName, lastName: 'Smith' })

describe('PresenceAvatars', () => {
  it('renders nothing when nobody is viewing', () => {
    renderWithProviders(<PresenceAvatars viewers={[]} />)
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('shows everyone, with you first and marked as you', () => {
    renderWithProviders(<PresenceAvatars viewers={[person(2, 'Bob'), { ...ada }, person(3, 'Cy')]} />)

    const items = within(screen.getByRole('list', { name: 'People viewing this board' })).getAllByRole('listitem')
    expect(items.map((i) => i.getAttribute('aria-label'))).toEqual(['Ada Lovelace (you)', 'Bob Smith', 'Cy Smith'])
  })

  it('collapses extras into a +N bubble that lists their names', () => {
    const viewers = [ada, person(2, 'Bob'), person(3, 'Cy'), person(4, 'Di'), person(5, 'Ed'), person(6, 'Flo')]
    renderWithProviders(<PresenceAvatars viewers={viewers} />)

    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    const more = screen.getByLabelText('2 more')
    expect(more).toHaveTextContent('+2')
    expect(more).toHaveAttribute('title', 'Ed Smith, Flo Smith')
  })

  it('does not show an overflow bubble at exactly the limit', () => {
    renderWithProviders(<PresenceAvatars viewers={[ada, person(2, 'Bob'), person(3, 'Cy'), person(4, 'Di')]} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    expect(screen.queryByText(/^\+/)).toBeNull()
  })
})
