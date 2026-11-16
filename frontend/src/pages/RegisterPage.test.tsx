import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { locationOf, renderWithProviders } from '../test/utils'
import RegisterPage from './RegisterPage'

const mount = (register = vi.fn().mockResolvedValue(undefined)) =>
  ({ register, ...renderWithProviders(<RegisterPage />, { route: '/register', path: '/register', user: null, auth: { register } }) })

async function fill(user: ReturnType<typeof mount>['user'], phone = '') {
  await user.type(screen.getByLabelText('First name'), 'Ada')
  await user.type(screen.getByLabelText('Last name'), 'Lovelace')
  await user.type(screen.getByLabelText('Email'), 'ada@example.com')
  if (phone) await user.type(screen.getByLabelText('Phone (optional)'), phone)
  await user.type(screen.getByLabelText('Password (min 8 characters)'), 'Password123!')
}

describe('RegisterPage', () => {
  it('submits all fields and sends the user to log in with a note', async () => {
    const { user, register, container } = mount()
    await fill(user, '5551234567')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(register).toHaveBeenCalledWith({ firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phoneNumber: '(555) 123-4567', password: 'Password123!' })
    await screen.findByText('other page')
    expect(locationOf(container)).toEqual({ path: '/login', state: { registered: true } })
  })

  it('formats the phone number as digits are typed, ignoring other characters, with a format placeholder', async () => {
    const { user } = mount()
    const phone = screen.getByLabelText('Phone (optional)')
    expect(phone).toHaveAttribute('placeholder', '(xxx) xxx-xxxx')
    await user.type(phone, 'a9-1.2 3x456789999')
    expect(phone).toHaveValue('(912) 345-6789')
  })

  it('pasting a number with a country code is cleaned up', async () => {
    const { user } = mount()
    await user.click(screen.getByLabelText('Phone (optional)'))
    await user.paste('+1 (912) 345-6789')
    expect(screen.getByLabelText('Phone (optional)')).toHaveValue('(912) 345-6789')
  })

  it('does not submit a partial phone number', async () => {
    const { user, register } = mount()
    await fill(user, '91234')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(register).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Phone (optional)')).toBeInvalid()
  })

  it('omits an empty phone number', async () => {
    const { user, register } = mount()
    await fill(user)
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(register.mock.calls[0][0].phoneNumber).toBeUndefined()
  })

  it('shows the API error and stays on the page', async () => {
    const { user } = mount(vi.fn().mockRejectedValue(new Error('Email is already registered.')))
    await fill(user)
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Email is already registered.')
    expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled()
  })

  it('does not submit while required fields are empty', async () => {
    const { user, register } = mount()
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(register).not.toHaveBeenCalled()
  })
})
