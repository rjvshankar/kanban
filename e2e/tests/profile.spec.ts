import { expect, test, type Page } from '@playwright/test'
import { createBoard, signUpAndLogin } from '../helpers/api'

// 2x2 red PNG; the browser decodes and crops it exactly like a real photo.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP4z8AARAwQCgAf7gP9i18U1AAAAABJRU5ErkJggg==', 'base64')

async function openEditProfile(page: Page) {
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Edit profile' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

test.describe('profile dialog', () => {
  test('changing the name updates the header and survives a reload', async ({ page }) => {
    await signUpAndLogin(page, 'Ada')
    await page.goto('/')

    await openEditProfile(page)
    await page.getByLabel('First name').fill('Grace')
    await page.getByLabel('Last name').fill('Hopper')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByRole('heading', { name: 'Your profile' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Account menu' })).toContainText('Grace')
    await page.reload()
    await expect(page.getByRole('button', { name: 'Account menu' })).toContainText('Grace')
  })

  test('the phone number formats itself as digits are typed, persists, and can be cleared', async ({ page }) => {
    await signUpAndLogin(page, 'Ada')
    await page.goto('/')
    const phone = page.getByLabel('Phone (optional)')

    await openEditProfile(page)
    await expect(phone).toHaveValue('')
    await expect(phone).toHaveAttribute('placeholder', '(xxx) xxx-xxxx')
    await phone.pressSequentially('5a5-5123 4567')
    await expect(phone).toHaveValue('(555) 123-4567')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)

    await page.reload()
    await openEditProfile(page)
    await expect(phone).toHaveValue('(555) 123-4567')
    await phone.fill('')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)

    await page.reload()
    await openEditProfile(page)
    await expect(phone).toHaveValue('')
  })

  test('an incomplete phone number cannot be saved', async ({ page }) => {
    await signUpAndLogin(page, 'Ada')
    await page.goto('/')
    await openEditProfile(page)
    const phone = page.getByLabel('Phone (optional)')
    await phone.pressSequentially('12345')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(phone).toHaveJSProperty('validity.patternMismatch', true)
  })

  test('registering with a phone number stores it formatted', async ({ page }) => {
    const email = `phone.${Date.now()}@example.com`
    await page.goto('/register')
    await page.getByLabel('First name').fill('Pat')
    await page.getByLabel('Last name').fill('Phone')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Phone (optional)').pressSequentially('9123456789')
    await expect(page.getByLabel('Phone (optional)')).toHaveValue('(912) 345-6789')
    await page.getByLabel('Password (min 8 characters)').fill('Password123!')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page).toHaveURL(/\/login/)

    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill('Password123!')
    await page.getByRole('button', { name: /log in/i }).click()
    await openEditProfile(page)
    await expect(page.getByLabel('Phone (optional)')).toHaveValue('(912) 345-6789')
  })

  test('uploading a photo shows it in the header, it persists, and Remove brings back the initials', async ({ page }) => {
    const user = await signUpAndLogin(page, 'Ada')
    await page.goto('/')
    const avatarImg = page.getByRole('button', { name: 'Account menu' }).locator('img')
    await expect(avatarImg).toHaveCount(0)

    await openEditProfile(page)
    await page.getByLabel('Profile photo').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG })
    await expect(page.getByRole('heading', { name: 'Adjust photo' })).toBeVisible()
    await page.getByRole('button', { name: 'Use photo' }).click()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0) // the header is hidden from the a11y tree while the dialog is open

    await expect(avatarImg).toHaveAttribute('src', new RegExp(`/api/users/${user.id}/avatar\\?v=\\d+`))
    const res = await page.request.get(`/api/users/${user.id}/avatar`)
    expect(res.ok()).toBe(true)
    expect(res.headers()['content-type']).toMatch(/^image\/(webp|png)$/)

    await page.reload()
    await expect(avatarImg).toBeVisible()
    // The browser really decoded the picture (not a broken image).
    await expect.poll(() => avatarImg.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(256)

    await openEditProfile(page)
    await page.getByRole('button', { name: 'Remove' }).click()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(avatarImg).toHaveCount(0)
    expect((await page.request.get(`/api/users/${user.id}/avatar`)).status()).toBe(404)
  })

  test('dark mode switch in the menu applies at once, is remembered in a cookie and survives reload and logout', async ({ context, page }) => {
    await signUpAndLogin(page, 'Ada')
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    const html = page.locator('html')
    await expect(html).not.toHaveClass(/dark/)

    await page.getByRole('button', { name: 'Account menu' }).click()
    await page.getByRole('menuitemcheckbox', { name: 'Dark mode' }).click()
    await expect(html).toHaveClass(/dark/)
    // The menu stays open so the change is visible.
    await expect(page.getByRole('menuitemcheckbox', { name: 'Dark mode' })).toBeChecked()
    expect((await context.cookies()).find((c) => c.name === 'kanban_theme')?.value).toBe('dark')

    await page.keyboard.press('Escape')
    await page.reload()
    await expect(html).toHaveClass(/dark/)

    // Log out from the same menu; the login page is still dark.
    await page.getByRole('button', { name: 'Account menu' }).click()
    await page.getByRole('menuitem', { name: /log out/i }).click()
    await expect(page).toHaveURL(/\/login/)
    await expect(html).toHaveClass(/dark/)
  })

  test('the menu works from the board page too', async ({ page }) => {
    await signUpAndLogin(page, 'Ada')
    const id = await createBoard(page.request, 'Menu board')
    await page.goto(`/boards/${id}`)
    await page.getByRole('button', { name: 'Account menu' }).click()
    await page.getByRole('menuitem', { name: /log out/i }).click()
    await expect(page).toHaveURL(/\/login/)
  })

  test('the saved cookie wins over the OS setting', async ({ context, page }) => {
    await context.addCookies([{ name: 'kanban_theme', value: 'light', url: 'http://localhost:5273' }])
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/login')
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  })

  test('with no cookie the page follows the OS setting', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/login')
    await expect(page.locator('html')).toHaveClass(/dark/)
  })
})

test('the account menu stays in the same spot on the board list and on a board', async ({ page }) => {
  await signUpAndLogin(page, 'Ada')
  const id = await createBoard(page.request, 'Same spot')
  const trigger = page.getByRole('button', { name: 'Account menu' })

  await page.goto('/')
  await expect(trigger).toBeVisible()
  const onList = await trigger.boundingBox()

  await page.goto(`/boards/${id}`)
  await expect(page.getByRole('heading', { name: 'Same spot' })).toBeVisible()
  const onBoard = await trigger.boundingBox()

  expect(onBoard).toEqual(onList)
})
