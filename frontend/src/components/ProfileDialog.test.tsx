import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { ThemeProvider } from '@/theme/ThemeProvider'
import { THEME_COOKIE, readThemeCookie } from '@/theme/theme'
import { server } from '../test/server'
import { ada, http, HttpResponse, renderWithProviders, url } from '../test/utils'
import ProfileDialog from './ProfileDialog'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
// jsdom has no canvas; the real crop maths is tested in avatarCrop.test.ts.
vi.mock('../lib/avatarCrop', async (orig) => ({
  ...(await orig<typeof import('../lib/avatarCrop')>()),
  draw: vi.fn(),
  cropToBlob: vi.fn(async () => new Blob(['img'], { type: 'image/png' })),
}))

function mount(user = ada, auth = {}) {
  const onClose = vi.fn()
  const updateUser = vi.fn()
  const result = renderWithProviders(<ThemeProvider><ProfileDialog user={user} onClose={onClose} /></ThemeProvider>, { auth: { updateUser, ...auth } })
  return { ...result, onClose, updateUser }
}

// Loads the cropper's <img> (jsdom never decodes images, so we fire the event ourselves).
async function pickPhoto(file = new File(['x'], 'me.png', { type: 'image/png' })) {
  const input = screen.getByLabelText('Profile photo') as HTMLInputElement
  const images: HTMLImageElement[] = []
  const OrigImage = window.Image
  vi.stubGlobal('Image', class extends OrigImage { constructor() { super(); images.push(this) } })
  fireEvent.change(input, { target: { files: [file] } })
  await waitFor(() => expect(images).toHaveLength(1))
  Object.defineProperty(images[0], 'naturalWidth', { value: 400 })
  Object.defineProperty(images[0], 'naturalHeight', { value: 300 })
  images[0].onload?.(new Event('load'))
}

beforeEach(() => {
  document.cookie = `${THEME_COOKIE}=; Path=/; Max-Age=0`
  document.documentElement.classList.remove('dark')
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

describe('ProfileDialog', () => {
  it('shows current details, email read-only, Save disabled until something changes', () => {
    mount()
    expect(screen.getByLabelText('First name')).toHaveValue('Ada')
    expect(screen.getByLabelText('Last name')).toHaveValue('Lovelace')
    expect(screen.getByLabelText('Email')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('saves a changed name, updates the user and closes', async () => {
    let body: unknown
    server.use(http.put(url('/auth/me'), async ({ request }) => {
      body = await request.json()
      return HttpResponse.json({ ...ada, firstName: 'Grace', lastName: 'Hopper' })
    }))
    const { user, onClose, updateUser } = mount()

    await user.clear(screen.getByLabelText('First name'))
    await user.type(screen.getByLabelText('First name'), '  Grace ')
    await user.clear(screen.getByLabelText('Last name'))
    await user.type(screen.getByLabelText('Last name'), 'Hopper')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(body).toEqual({ firstName: 'Grace', lastName: 'Hopper' })
    expect(updateUser).toHaveBeenCalledWith({ firstName: 'Grace', lastName: 'Hopper' })
    expect(toast.success).toHaveBeenCalled()
  })

  it('does not allow saving blank names', async () => {
    const { user } = mount()
    await user.clear(screen.getByLabelText('First name'))
    await user.type(screen.getByLabelText('First name'), '   ')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('shows the server error and stays open when saving fails', async () => {
    server.use(http.put(url('/auth/me'), () => HttpResponse.json({ error: 'nope' }, { status: 400 })))
    const { user, onClose } = mount()
    await user.type(screen.getByLabelText('First name'), 'x')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('nope'))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('crops a chosen photo, previews it, and uploads it on Save', async () => {
    let uploaded: FormDataEntryValue | null = null
    server.use(http.put(url('/auth/me/avatar'), async ({ request }) => {
      uploaded = (await request.formData()).get('file')
      return HttpResponse.json({ avatarVersion: 42 })
    }))
    const { user, onClose, updateUser } = mount()

    await pickPhoto()
    expect(screen.getByRole('heading', { name: 'Adjust photo' })).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Use photo' }))

    expect(screen.getByRole('heading', { name: 'Your profile' })).toBeInTheDocument()
    expect(document.querySelector('img')).toHaveAttribute('src', 'blob:preview')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(uploaded).toMatchObject({ size: 3, type: 'image/png' }) // the cropped blob, not the original file
    expect(updateUser).toHaveBeenCalledWith({ avatarVersion: 42 })
  })

  it('Back from the cropper keeps the old picture and nothing is saved', async () => {
    const { user } = mount()
    await pickPhoto()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('heading', { name: 'Your profile' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('rejects a non-image file', () => {
    mount()
    fireEvent.change(screen.getByLabelText('Profile photo'), { target: { files: [new File(['x'], 'a.txt', { type: 'text/plain' })] } })
    expect(toast.error).toHaveBeenCalledWith('Please choose an image file.')
    expect(screen.queryByRole('heading', { name: 'Adjust photo' })).not.toBeInTheDocument()
  })

  it('Remove deletes the saved picture on Save', async () => {
    let deleted = false
    server.use(http.delete(url('/auth/me/avatar'), () => { deleted = true; return new HttpResponse(null, { status: 204 }) }))
    const { user, updateUser, onClose } = mount({ ...ada, avatarVersion: 5 })

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(screen.getByText('AL')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(deleted).toBe(true)
    expect(updateUser).toHaveBeenCalledWith({ avatarVersion: null })
  })

  it('has no Remove button when there is no picture', () => {
    mount()
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
  })

  it('dark mode switch applies instantly and saves the cookie, with no API call', async () => {
    const { user } = mount()
    const toggle = screen.getByRole('switch', { name: 'Dark mode' })
    expect(toggle).not.toBeChecked()

    await user.click(toggle)
    expect(toggle).toBeChecked()
    expect(document.documentElement).toHaveClass('dark')
    expect(readThemeCookie()).toBe('dark')

    await user.click(toggle)
    expect(document.documentElement).not.toHaveClass('dark')
    expect(readThemeCookie()).toBe('light')
  })

  it('Cancel closes without saving', async () => {
    const { user, onClose } = mount()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
  })
})
