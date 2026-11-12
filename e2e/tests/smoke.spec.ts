import { expect, test } from '@playwright/test'
import { signUpAndLogin } from '../helpers/api'

test('the stack is up: health endpoint, login page, and a registered user can reach the board list', async ({ page }) => {
  expect((await page.request.get('/api/health')).ok()).toBe(true) // through the Vite proxy

  await page.goto('/login')
  await expect(page.getByLabel('Email')).toBeVisible()

  const user = await signUpAndLogin(page, 'Smoke')
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Your boards' })).toBeVisible()
  await expect(page.locator('header')).toContainText(user.firstName)
})
