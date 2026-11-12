import { expect, test } from '@playwright/test'
import { addMember, login, registerUser, seedBoard, signUpAndLogin } from '../helpers/api'
import { card, cardTitles, column, columnNames, drag, expectTitles } from '../helpers/board'

// Real mouse drags against dnd-kit. Each test also reloads to prove the new order was saved, not just drawn.
test.describe('dragging cards', () => {
  test('reorder within a column', async ({ page }) => {
    await signUpAndLogin(page)
    const { boardId } = await seedBoard(page.request, 'DnD', { 'To do': ['A', 'B', 'C'] })
    await page.goto(`/boards/${boardId}`)
    await expectTitles(page, 'To do', ['A', 'B', 'C'])

    await drag(page, card(page, 'A'), card(page, 'C'), { dy: 10 }) // drop on the lower half of C

    await expectTitles(page, 'To do', ['B', 'C', 'A'])
    await page.reload()
    await expectTitles(page, 'To do', ['B', 'C', 'A'])
  })

  test('move a card up to the top of its column', async ({ page }) => {
    await signUpAndLogin(page)
    const { boardId } = await seedBoard(page.request, 'DnD', { 'To do': ['A', 'B', 'C'] })
    await page.goto(`/boards/${boardId}`)

    await drag(page, card(page, 'C'), card(page, 'A'), { dy: -10 })

    await expectTitles(page, 'To do', ['C', 'A', 'B'])
    await page.reload()
    await expectTitles(page, 'To do', ['C', 'A', 'B'])
  })

  test('move a card into the middle of another column', async ({ page }) => {
    await signUpAndLogin(page)
    const { boardId } = await seedBoard(page.request, 'DnD', { 'To do': ['A', 'B'], Doing: ['X', 'Y'] })
    await page.goto(`/boards/${boardId}`)

    await drag(page, card(page, 'A'), card(page, 'X'), { dy: 10, intoOtherColumn: true }) // after X

    await expectTitles(page, 'To do', ['B'])
    await expectTitles(page, 'Doing', ['X', 'A', 'Y'])
    await page.reload()
    await expectTitles(page, 'To do', ['B'])
    await expectTitles(page, 'Doing', ['X', 'A', 'Y'])
  })

  test('move a card into an empty column', async ({ page }) => {
    await signUpAndLogin(page)
    const { boardId } = await seedBoard(page.request, 'DnD', { 'To do': ['A', 'B'], Done: [] })
    await page.goto(`/boards/${boardId}`)

    await drag(page, card(page, 'B'), column(page, 'Done').locator('ul'))

    await expectTitles(page, 'To do', ['A'])
    await expectTitles(page, 'Done', ['B'])
    await page.reload()
    await expectTitles(page, 'Done', ['B'])
  })

  test('a plain click still opens the card (it is not mistaken for a drag)', async ({ page }) => {
    await signUpAndLogin(page)
    const { boardId } = await seedBoard(page.request, 'DnD', { 'To do': ['A'] })
    await page.goto(`/boards/${boardId}`)

    await card(page, 'A').click()
    await expect(page.getByRole('dialog', { name: 'Edit card' })).toBeVisible()
  })

  test('editors can drag cards; viewers cannot', async ({ page, browser }) => {
    await signUpAndLogin(page, 'Owner')
    const { boardId } = await seedBoard(page.request, 'DnD', { 'To do': ['A', 'B', 'C'] })
    const editor = await registerUser(page.request, 'Editor')
    const viewer = await registerUser(page.request, 'Viewer')
    await addMember(page.request, boardId, editor, 'editor')
    await addMember(page.request, boardId, viewer, 'viewer')

    // Viewer: the drag does nothing, and nothing is saved.
    const viewerCtx = await browser.newContext()
    const viewerPage = await viewerCtx.newPage()
    await login(viewerPage.request, viewer)
    await viewerPage.goto(`/boards/${boardId}`)
    await expect(cardTitles(viewerPage, 'To do')).toHaveText(['A', 'B', 'C'])
    await drag(viewerPage, card(viewerPage, 'A'), card(viewerPage, 'C'), { dy: 10, expectSave: false })
    await expect(cardTitles(viewerPage, 'To do')).toHaveText(['A', 'B', 'C'])
    await viewerPage.reload()
    await expect(cardTitles(viewerPage, 'To do')).toHaveText(['A', 'B', 'C'])
    await viewerCtx.close()

    // Editor: can.
    const editorCtx = await browser.newContext()
    const editorPage = await editorCtx.newPage()
    await login(editorPage.request, editor)
    await editorPage.goto(`/boards/${boardId}`)
    await drag(editorPage, card(editorPage, 'A'), card(editorPage, 'C'), { dy: 10 })
    await expect(cardTitles(editorPage, 'To do')).toHaveText(['B', 'C', 'A'])
    await editorCtx.close()
  })
})

test.describe('dragging columns', () => {
  test('an owner reorders columns with the grip handle, and the order persists', async ({ page }) => {
    await signUpAndLogin(page)
    const { boardId } = await seedBoard(page.request, 'DnD', { One: ['1'], Two: ['2'], Three: ['3'] })
    await page.goto(`/boards/${boardId}`)
    await expect(columnNames(page)).toHaveText(['One', 'Two', 'Three'])

    await drag(page, column(page, 'One').getByLabel('Drag column'), column(page, 'Three'), { dx: 40, grab: 'center' })

    await expect(columnNames(page)).toHaveText(['Two', 'Three', 'One'])
    await expectTitles(page, 'One', ['1']) // cards travel with their column
    await page.reload()
    await expect(columnNames(page)).toHaveText(['Two', 'Three', 'One'])
  })

  test('only owners get a drag handle', async ({ page, browser }) => {
    await signUpAndLogin(page, 'Owner')
    const { boardId } = await seedBoard(page.request, 'DnD', { One: [] })
    const editor = await registerUser(page.request, 'Editor')
    await addMember(page.request, boardId, editor, 'editor')

    const ctx = await browser.newContext()
    const editorPage = await ctx.newPage()
    await login(editorPage.request, editor)
    await editorPage.goto(`/boards/${boardId}`)
    await expect(editorPage.getByRole('heading', { name: 'One', exact: true })).toBeVisible()
    await expect(editorPage.getByLabel('Drag column')).toHaveCount(0)
    await ctx.close()
  })
})
