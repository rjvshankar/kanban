import { expect, test } from '@playwright/test'
import { addMember, deleteBoard, login, registerUser, seedBoard, signUpAndLogin } from '../helpers/api'
import { ageDeletedBoard, runPurge } from '../helpers/db'
import { card } from '../helpers/board'

// Time travel: the 30-day window is simulated by back-dating the board in SQL, then running the same
// stored procedure the daily background job runs.
test.describe('archive, purge and restore', () => {
  test('a deleted board is restorable for 30 days; after the purge it can be retrieved from the long-term archive and restored', async ({ page }) => {
    await signUpAndLogin(page)
    const { boardId } = await seedBoard(page.request, 'Precious', { 'To do': ['Keep this card'] })

    // 1. Delete it in the UI.
    await page.goto('/')
    await page.getByLabel('Delete Precious').click()
    await page.getByRole('button', { name: 'Delete board' }).click()
    await expect(page.getByRole('heading', { name: 'Archived boards' })).toBeVisible()
    await expect(page.getByText('30 days left to restore')).toBeVisible()

    // 2. Inside the window a purge leaves it alone.
    await ageDeletedBoard(boardId, 10)
    await runPurge()
    await page.reload()
    await expect(page.getByText('20 days left to restore')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Long-term archive' })).toHaveCount(0)

    // 3. Past the window the purge moves it to the long-term archive.
    await ageDeletedBoard(boardId, 31)
    await runPurge()
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Archived boards' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Long-term archive' })).toBeVisible()
    await expect(page.getByText('Precious')).toBeVisible()

    // 4. Retrieve it: it comes back as an archived board with a fresh 30 days.
    await page.getByRole('button', { name: /retrieve/i }).click()
    await expect(page.getByText('30 days left to restore')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Long-term archive' })).toHaveCount(0)

    // 5. Restore it: back in the list, contents intact.
    await page.getByRole('button', { name: /restore/i }).click()
    await page.getByRole('link', { name: 'Precious' }).click()
    await expect(card(page, 'Keep this card')).toBeVisible()
  })

  test('only owners can see and restore archived boards', async ({ page, browser }) => {
    await signUpAndLogin(page, 'Owner')
    const { boardId } = await seedBoard(page.request, 'Owners only', { 'To do': [] })
    const editor = await registerUser(page.request, 'Editor')
    await addMember(page.request, boardId, editor, 'editor')
    await deleteBoard(page.request, boardId)

    const ctx = await browser.newContext()
    const editorPage = await ctx.newPage()
    await login(editorPage.request, editor)
    await editorPage.goto('/')
    await expect(editorPage.getByText('No boards yet. Create one above.')).toBeVisible()
    await expect(editorPage.getByRole('heading', { name: 'Archived boards' })).toHaveCount(0)
    expect((await editorPage.request.post(`/api/boards/${boardId}/restore`)).status()).toBe(404)

    await ageDeletedBoard(boardId, 31)
    await runPurge()
    await editorPage.reload()
    await expect(editorPage.getByRole('heading', { name: 'Long-term archive' })).toHaveCount(0)
    expect((await editorPage.request.post(`/api/boards/${boardId}/restore-purged`)).status()).toBe(404)
    await ctx.close()
  })

  test('a board past its 30 days can no longer be restored directly', async ({ page }) => {
    await signUpAndLogin(page)
    const { boardId } = await seedBoard(page.request, 'Too late', { 'To do': [] })
    await deleteBoard(page.request, boardId)
    await ageDeletedBoard(boardId, 31)

    expect((await page.request.post(`/api/boards/${boardId}/restore`)).status()).toBe(404)
  })
})
