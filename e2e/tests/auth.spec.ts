import { expect, test } from '@playwright/test'
import { PASSWORD, registerUser, signUpAndLogin } from '../helpers/api'

test.describe('registration and login', () => {
  test('register, see the confirmation, log in, land on the board list', async ({ page }) => {
    const email = `new.${Date.now()}@example.com`
    await page.goto('/register')
    await page.getByLabel('First name').fill('Grace')
    await page.getByLabel('Last name').fill('Hopper')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password (min 8 characters)').fill(PASSWORD)
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page).toHaveURL('/login')
    await expect(page.getByText('Account created. Please log in.')).toBeVisible()

    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Log in' }).click()

    await expect(page).toHaveURL('/')
    await expect(page.getByRole('heading', { name: 'Your boards' })).toBeVisible()
    await expect(page.locator('header')).toContainText('Grace')
  })

  test('registering an email that already exists shows an error', async ({ page }) => {
    const existing = await registerUser(page.request)
    await page.goto('/register')
    await page.getByLabel('First name').fill('Dup')
    await page.getByLabel('Last name').fill('Licate')
    await page.getByLabel('Email').fill(existing.email.toUpperCase()) // case must not matter
    await page.getByLabel('Password (min 8 characters)').fill(PASSWORD)
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page.getByRole('alert')).toHaveText('Email is already registered.')
    await expect(page).toHaveURL('/register')
  })

  test('the browser blocks a too-short password before anything is sent', async ({ page }) => {
    let registerCalls = 0
    page.on('request', (r) => { if (r.url().includes('/api/auth/register')) registerCalls++ })
    await page.goto('/register')
    await page.getByLabel('First name').fill('Short')
    await page.getByLabel('Last name').fill('Pw')
    await page.getByLabel('Email').fill('short@example.com')
    await page.getByLabel('Password (min 8 characters)').fill('abc')
    await page.getByRole('button', { name: 'Create account' }).click()

    expect(await page.getByLabel('Password (min 8 characters)').evaluate((el: HTMLInputElement) => el.validity.tooShort)).toBe(true)
    await expect(page).toHaveURL('/register')
    expect(registerCalls).toBe(0)
  })

  test('wrong password and unknown email give the same error', async ({ page }) => {
    const user = await registerUser(page.request)
    for (const [email, password] of [[user.email, 'WrongPassword1'], ['nobody@example.com', 'WrongPassword1']]) {
      await page.goto('/login')
      await page.getByLabel('Email').fill(email)
      await page.getByLabel('Password').fill(password)
      await page.getByRole('button', { name: 'Log in' }).click()
      await expect(page.getByRole('alert')).toHaveText('Invalid email or password.')
    }
  })
})

test.describe('sessions and protected pages', () => {
  test('a logged-out visitor is sent to log in and returned to the page they wanted afterwards', async ({ page }) => {
    const user = await registerUser(page.request)
    await page.goto('/boards/123456')
    await expect(page).toHaveURL('/login')

    await page.getByLabel('Email').fill(user.email)
    await page.getByLabel('Password').fill(user.password)
    await page.getByRole('button', { name: 'Log in' }).click()

    await expect(page).toHaveURL('/boards/123456')
  })

  test('the session survives a reload', async ({ page }) => {
    await signUpAndLogin(page)
    await page.goto('/')
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Your boards' })).toBeVisible()
  })

  test('logging out ends the session', async ({ page }) => {
    await signUpAndLogin(page)
    await page.goto('/')
    await page.getByRole('button', { name: /log out/i }).click()
    await expect(page).toHaveURL('/login')

    await page.goto('/')
    await expect(page).toHaveURL('/login')
  })

  test('a logged-in user visiting /login or /register is sent home', async ({ page }) => {
    await signUpAndLogin(page)
    for (const path of ['/login', '/register', '/forgot-password']) {
      await page.goto(path)
      await expect(page).toHaveURL('/')
    }
  })

  test('the login cookie is httpOnly, so page scripts cannot read it', async ({ page }) => {
    await signUpAndLogin(page)
    await page.goto('/')
    expect(await page.evaluate(() => document.cookie)).not.toContain('kanban_auth')
    const cookies = await page.context().cookies()
    expect(cookies.find((c) => c.name === 'kanban_auth')).toMatchObject({ httpOnly: true, sameSite: 'Strict' })
  })

  test('when the session expires mid-use the user is sent back to log in', async ({ page }) => {
    await signUpAndLogin(page)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Your boards' })).toBeVisible()

    await page.context().clearCookies() // simulates an expired/revoked session
    await page.getByPlaceholder('New board name').fill('Will fail')
    await page.getByRole('button', { name: /create/i }).click()

    await expect(page).toHaveURL('/login')
  })
})
