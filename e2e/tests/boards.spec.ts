import { expect, test } from '@playwright/test'
import { addMember, createBoard, registerUser, login, signUpAndLogin } from '../helpers/api'

test.describe('board list', () => {
  test('a new user sees the empty state, creates a board and opens it', async ({ page }) => {
    await signUpAndLogin(page)
    await page.goto('/')
    await expect(page.getByText('No boards yet. Create one above.')).toBeVisible()

    await page.getByPlaceholder('New board name').fill('Sprint 1')
    await page.getByRole('button', { name: /create/i }).click()

    await expect(page.getByPlaceholder('New board name')).toHaveValue('')
    await page.getByRole('link', { name: 'Sprint 1' }).click()
    await expect(page.getByRole('heading', { name: 'Sprint 1' })).toBeVisible()
    await expect(page.getByText('No boards yet.')).toHaveCount(0)
  })

  test('boards are private: other users do not see them and cannot open them by URL', async ({ page, browser }) => {
    await signUpAndLogin(page)
    const boardId = await createBoard(page.request, 'Secret plans')

    const other = await browser.newContext()
    const otherPage = await other.newPage()
    await signUpAndLogin(otherPage, 'Other')
    await otherPage.goto('/')
    await expect(otherPage.getByText('No boards yet. Create one above.')).toBeVisible()
    await otherPage.goto(`/boards/${boardId}`)
    await expect(otherPage.getByText('Board not found.')).toBeVisible()
    await expect(otherPage.getByText('Secret plans')).toHaveCount(0)
    await other.close()
  })

  test('shared boards show the role you have; only owned boards offer delete', async ({ page, browser }) => {
    await signUpAndLogin(page)
    const owner = await browser.newContext()
    const ownerPage = await owner.newPage()
    const ownerUser = await signUpAndLogin(ownerPage, 'Owner')
    const me = await registerUser(page.request, 'Member')
    await login(page.request, me)
    const sharedId = await createBoard(ownerPage.request, 'Shared board')
    await addMember(ownerPage.request, sharedId, me, 'viewer')
    await createBoard(page.request, 'My own board')

    await page.goto('/')
    const shared = page.getByRole('listitem').filter({ hasText: 'Shared board' })
    await expect(shared).toContainText('viewer')
    await expect(shared.getByRole('button', { name: /delete/i })).toHaveCount(0)
    const mine = page.getByRole('listitem').filter({ hasText: 'My own board' })
    await expect(mine).toContainText('owner')
    await expect(mine.getByRole('button', { name: 'Delete My own board' })).toBeVisible()
    expect(ownerUser.id).not.toBe(me.id)
    await owner.close()
  })
})

test.describe('board settings', () => {
  test('rename a board; the new name persists after reload', async ({ page }) => {
    await signUpAndLogin(page)
    const id = await createBoard(page.request, 'Old name')
    await page.goto(`/boards/${id}`)

    await page.getByLabel('Rename board').click()
    await page.getByRole('dialog').getByRole('textbox').fill('New name')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('heading', { name: 'New name' })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('heading', { name: 'New name' })).toBeVisible()
  })

  test('cancelling a delete keeps the board; confirming moves it to Archived boards, and it can be restored', async ({ page }) => {
    await signUpAndLogin(page)
    await createBoard(page.request, 'Doomed')
    await page.goto('/')

    await page.getByLabel('Delete Doomed').click()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('link', { name: 'Doomed' })).toBeVisible()

    await page.getByLabel('Delete Doomed').click()
    await expect(page.getByText('Delete "Doomed"?')).toBeVisible()
    await page.getByRole('button', { name: 'Delete board' }).click()

    await expect(page.getByRole('link', { name: 'Doomed' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Archived boards' })).toBeVisible()
    await expect(page.getByText('30 days left to restore')).toBeVisible()

    await page.getByRole('button', { name: /restore/i }).click()
    await expect(page.getByRole('link', { name: 'Doomed' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Archived boards' })).toHaveCount(0)
  })

  test('a deleted board cannot be opened', async ({ page }) => {
    await signUpAndLogin(page)
    const id = await createBoard(page.request, 'Gone soon')
    await page.request.delete(`/api/boards/${id}`)
    await page.goto(`/boards/${id}`)
    await expect(page.getByText('Board not found.')).toBeVisible()
    await page.getByRole('link', { name: 'Back to boards' }).click()
    await expect(page).toHaveURL('/')
  })
})
