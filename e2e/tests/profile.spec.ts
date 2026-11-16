import { expect, test } from '@playwright/test'
import { signUpAndLogin } from '../helpers/api'

// 2x2 red PNG; the browser decodes and crops it exactly like a real photo.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP4z8AARAwQCgAf7gP9i18U1AAAAABJRU5ErkJggg==', 'base64')

test.describe('profile dialog', () => {
  test('changing the name updates the header and survives a reload', async ({ page }) => {
    await signUpAndLogin(page, 'Ada')
    await page.goto('/')

    await page.getByRole('button', { name: 'Open profile' }).click()
    await page.getByLabel('First name').fill('Grace')
    await page.getByLabel('Last name').fill('Hopper')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByRole('heading', { name: 'Your profile' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Open profile' })).toContainText('Grace')
    await page.reload()
    await expect(page.getByRole('button', { name: 'Open profile' })).toContainText('Grace')
  })

  test('uploading a photo shows it in the header, it persists, and Remove brings back the initials', async ({ page }) => {
    const user = await signUpAndLogin(page, 'Ada')
    await page.goto('/')
    const avatarImg = page.getByRole('button', { name: 'Open profile' }).locator('img')
    await expect(avatarImg).toHaveCount(0)

    await page.getByRole('button', { name: 'Open profile' }).click()
    await page.getByLabel('Profile photo').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG })
    await expect(page.getByRole('heading', { name: 'Adjust photo' })).toBeVisible()
    await page.getByRole('button', { name: 'Use photo' }).click()
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(avatarImg).toHaveAttribute('src', new RegExp(`/api/users/${user.id}/avatar\\?v=\\d+`))
    const res = await page.request.get(`/api/users/${user.id}/avatar`)
    expect(res.ok()).toBe(true)
    expect(res.headers()['content-type']).toMatch(/^image\/(webp|png)$/)

    await page.reload()
    await expect(avatarImg).toBeVisible()
    // The browser really decoded the picture (not a broken image).
    await expect.poll(() => avatarImg.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(256)

    await page.getByRole('button', { name: 'Open profile' }).click()
    await page.getByRole('button', { name: 'Remove' }).click()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(avatarImg).toHaveCount(0)
    expect((await page.request.get(`/api/users/${user.id}/avatar`)).status()).toBe(404)
  })

  test('dark mode switch applies at once, is remembered in a cookie and survives reload and logout', async ({ context, page }) => {
    await signUpAndLogin(page, 'Ada')
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    const html = page.locator('html')
    await expect(html).not.toHaveClass(/dark/)

    await page.getByRole('button', { name: 'Open profile' }).click()
    await page.getByRole('switch', { name: 'Dark mode' }).click()
    await expect(html).toHaveClass(/dark/)
    expect((await context.cookies()).find((c) => c.name === 'kanban_theme')?.value).toBe('dark')

    await page.keyboard.press('Escape')
    await page.reload()
    await expect(html).toHaveClass(/dark/)

    // Still dark on the logged-out login page.
    await page.getByRole('button', { name: /log out/i }).click()
    await expect(page).toHaveURL(/\/login/)
    await expect(html).toHaveClass(/dark/)

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
