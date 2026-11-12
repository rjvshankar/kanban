import { expect, test } from '@playwright/test'
import { registerUser } from '../helpers/api'
import { emailCount, resetLinkFrom, waitForEmail } from '../helpers/mailpit'

// The API allows 3 forgot-password requests per IP per 15 minutes and these tests share one IP,
// so this file makes exactly two such requests (and the config disables retries for the same reason).
test.describe('password reset by email', () => {
  test('forgot password -> email -> new password -> old one stops working, link is single use', async ({ page }) => {
    const user = await registerUser(page.request)

    await page.goto('/forgot-password')
    await page.getByLabel('Email').fill(user.email)
    await page.getByRole('button', { name: 'Send reset link' }).click()
    await expect(page.getByText('If that email is registered, a reset link has been sent.')).toBeVisible()

    const link = resetLinkFrom(await waitForEmail(user.email))
    await page.goto(link)
    await page.getByLabel('New password (min 8 characters)').fill('BrandNewPass456!')
    await page.getByRole('button', { name: 'Reset password' }).click()

    await expect(page).toHaveURL('/login')
    await expect(page.getByText('Password updated. Please log in.')).toBeVisible()

    // Old password rejected, new one accepted.
    await page.getByLabel('Email').fill(user.email)
    await page.getByLabel('Password').fill(user.password)
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page.getByRole('alert')).toHaveText('Invalid email or password.')
    await page.getByLabel('Password').fill('BrandNewPass456!')
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page).toHaveURL('/')

    // The same link cannot be used twice.
    await page.context().clearCookies()
    await page.goto(link)
    await page.getByLabel('New password (min 8 characters)').fill('YetAnotherPass789!')
    await page.getByRole('button', { name: 'Reset password' }).click()
    await expect(page.getByRole('alert')).toHaveText('This reset link is invalid or has expired.')
  })

  test('an unknown email gets the same confirmation but no email is sent', async ({ page }) => {
    const address = `ghost.${Date.now()}@example.com`
    await page.goto('/forgot-password')
    await page.getByLabel('Email').fill(address)
    await page.getByRole('button', { name: 'Send reset link' }).click()

    await expect(page.getByText('If that email is registered, a reset link has been sent.')).toBeVisible()
    await page.waitForTimeout(500) // give a (wrongly) sent email time to arrive
    expect(await emailCount(address)).toBe(0)
  })

  test('a reset link with no token explains the problem', async ({ page }) => {
    await page.goto('/reset-password')
    await expect(page.getByText(/missing its token/i)).toBeVisible()
    await page.getByRole('link', { name: 'Request a new one' }).click()
    await expect(page).toHaveURL('/forgot-password')
  })

  test('a made-up token is rejected', async ({ page }) => {
    await page.goto('/reset-password?token=not-a-real-token')
    await page.getByLabel('New password (min 8 characters)').fill('BrandNewPass456!')
    await page.getByRole('button', { name: 'Reset password' }).click()
    await expect(page.getByRole('alert')).toHaveText('This reset link is invalid or has expired.')
  })
})
