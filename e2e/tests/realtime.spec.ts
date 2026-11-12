import { expect, test, type Browser, type Page } from '@playwright/test'
import { addMember, changeRole, createCard, deleteBoard, login, registerUser, removeMember, seedBoard, signUpAndLogin } from '../helpers/api'
import { card, column, columnNames, expectTitles, gotoBoardLive } from '../helpers/board'

/** Two people on the same board, each in their own browser session, both with the page open. */
async function twoPeople(browser: Browser, page: Page, otherRole: 'editor' | 'viewer', columns: Record<string, string[]> = { 'To do': ['Existing'], Done: [] }) {
  const owner = await signUpAndLogin(page, 'Owner')
  const { boardId, columnIds } = await seedBoard(page.request, 'Live', columns)
  const other = await registerUser(page.request, 'Other')
  await addMember(page.request, boardId, other, otherRole)
  const ctx = await browser.newContext()
  const otherPage = await ctx.newPage()
  await login(otherPage.request, other)

  await Promise.all([gotoBoardLive(page, boardId), gotoBoardLive(otherPage, boardId)])
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible()
  await expect(otherPage.getByRole('heading', { name: 'Live' })).toBeVisible()
  return { owner, other, boardId, columnIds, otherPage, ctx }
}

test.describe('live updates between two people on the same board', () => {
  test('a card added by an editor appears for the owner without reloading', async ({ page, browser }) => {
    const { otherPage, ctx } = await twoPeople(browser, page, 'editor')

    await column(otherPage, 'Done').getByPlaceholder('Add a card').fill('Added live')
    await column(otherPage, 'Done').getByRole('button', { name: 'Add card' }).click()

    await expect(card(page, 'Added live')).toBeVisible()
    await ctx.close()
  })

  test('edits, moves and deletes by the owner show up for the viewer', async ({ page, browser }) => {
    const { boardId, columnIds, otherPage, ctx } = await twoPeople(browser, page, 'viewer')

    // rename a column
    await page.getByLabel('Rename column').first().click()
    await page.getByRole('dialog').getByRole('textbox').fill('Backlog')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(otherPage.getByRole('heading', { name: 'Backlog', exact: true })).toBeVisible()

    // add a column
    await page.getByPlaceholder('New column').fill('Review')
    await page.getByRole('button', { name: 'Add column' }).click()
    await expect(columnNames(otherPage)).toHaveText(['Backlog', 'Done', 'Review'])

    // edit a card
    await card(page, 'Existing').click()
    await page.getByLabel('Title').fill('Renamed card')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(card(otherPage, 'Renamed card')).toBeVisible()

    // move a card to another column (through the API, as the owner)
    const cardId = await createCard(page.request, columnIds['To do'], 'Mover')
    await expect(card(otherPage, 'Mover')).toBeVisible()
    await page.request.post(`/api/cards/${cardId}/move`, { data: { toColumnId: columnIds.Done, afterCardId: null } })
    await expectTitles(otherPage, 'Done', ['Mover'])

    // delete the card
    await page.request.delete(`/api/cards/${cardId}`)
    await expect(card(otherPage, 'Mover')).toHaveCount(0)
    expect(boardId).toBeGreaterThan(0)
    await ctx.close()
  })

  test("changing someone's role updates their open page immediately", async ({ page, browser }) => {
    const { boardId, other, otherPage, ctx } = await twoPeople(browser, page, 'viewer')
    await expect(otherPage.getByPlaceholder('Add a card')).toHaveCount(0)
    await expect(otherPage.locator('header')).toContainText('viewer')

    await changeRole(page.request, boardId, other, 'editor')

    await expect(otherPage.locator('header')).toContainText('editor')
    await expect(otherPage.getByPlaceholder('Add a card').first()).toBeVisible()

    await changeRole(page.request, boardId, other, 'viewer')
    await expect(otherPage.getByPlaceholder('Add a card')).toHaveCount(0)
    await ctx.close()
  })

  test('removing someone from the board kicks them out of the page they have open', async ({ page, browser }) => {
    const { boardId, other, otherPage, ctx } = await twoPeople(browser, page, 'editor')

    await removeMember(page.request, boardId, other)

    await expect(otherPage.getByText('Board not found.')).toBeVisible()
    await ctx.close()
  })

  test('deleting the board shows "Board not found" to everyone who has it open', async ({ page, browser }) => {
    const { boardId, otherPage, ctx } = await twoPeople(browser, page, 'viewer')

    await deleteBoard(page.request, boardId)

    await expect(otherPage.getByText('Board not found.')).toBeVisible()
    await expect(page.getByText('Board not found.')).toBeVisible()
    await ctx.close()
  })
})
