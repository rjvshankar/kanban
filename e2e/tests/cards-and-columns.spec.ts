import { expect, test } from '@playwright/test'
import { createBoard, seedBoard, signUpAndLogin } from '../helpers/api'
import { card, column, columnNames, expectTitles } from '../helpers/board'

test.describe('columns', () => {
  test('an owner builds a board from scratch: columns in order, cards in each', async ({ page }) => {
    await signUpAndLogin(page)
    const id = await createBoard(page.request, 'Fresh')
    await page.goto(`/boards/${id}`)

    for (const name of ['To do', 'Doing', 'Done']) {
      await page.getByPlaceholder('New column').fill(name)
      await page.getByRole('button', { name: 'Add column' }).click()
      await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
    }
    await expect(columnNames(page)).toHaveText(['To do', 'Doing', 'Done'])

    await column(page, 'To do').getByPlaceholder('Add a card').fill('First task')
    await column(page, 'To do').getByRole('button', { name: 'Add card' }).click()
    await column(page, 'To do').getByPlaceholder('Add a card').fill('Second task')
    await column(page, 'To do').getByRole('button', { name: 'Add card' }).click()

    await expectTitles(page, 'To do', ['First task', 'Second task'])
    await expect(column(page, 'To do')).toContainText('2') // card count
    await expect(card(page, 'First task')).toBeVisible()

    await page.reload()
    await expect(columnNames(page)).toHaveText(['To do', 'Doing', 'Done'])
    await expectTitles(page, 'To do', ['First task', 'Second task'])
  })

  test('rename a column', async ({ page }) => {
    await signUpAndLogin(page)
    const { boardId } = await seedBoard(page.request, 'B', { Backlog: [] })
    await page.goto(`/boards/${boardId}`)

    await page.getByLabel('Rename column').click()
    await page.getByRole('dialog').getByRole('textbox').fill('Ideas')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByRole('heading', { name: 'Ideas', exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Ideas', exact: true })).toBeVisible()
  })

  test('deleting a column asks first and takes its cards with it', async ({ page }) => {
    await signUpAndLogin(page)
    const { boardId } = await seedBoard(page.request, 'B', { Keep: ['stays'], Drop: ['goes'] })
    await page.goto(`/boards/${boardId}`)

    await column(page, 'Drop').getByLabel('Delete column').click()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(column(page, 'Drop')).toBeVisible()

    await column(page, 'Drop').getByLabel('Delete column').click()
    await expect(page.getByText('This column and all of its cards will be deleted.')).toBeVisible()
    await page.getByRole('button', { name: 'Delete column' }).click()

    await expect(page.getByRole('heading', { name: 'Drop', exact: true })).toHaveCount(0)
    await expect(page.getByText('goes')).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Keep', exact: true })).toBeVisible()
    await expect(page.getByText('stays')).toBeVisible()
  })
})

test.describe('cards', () => {
  test('edit title, description and due date; changes show on the card and survive a reload', async ({ page }) => {
    await signUpAndLogin(page)
    const { boardId } = await seedBoard(page.request, 'B', { 'To do': ['Draft'] })
    await page.goto(`/boards/${boardId}`)

    await card(page, 'Draft').click()
    const dialog = page.getByRole('dialog', { name: 'Edit card' })
    await dialog.getByLabel('Title').fill('Final copy')
    await dialog.getByLabel('Description').fill('Proofread twice')
    await dialog.getByLabel('Due date').fill('2031-02-03')
    await dialog.getByRole('button', { name: 'Save' }).click()

    await expect(dialog).toBeHidden()
    await expect(card(page, 'Final copy')).toContainText('2031-02-03')

    await page.reload()
    await card(page, 'Final copy').click()
    await expect(page.getByLabel('Description')).toHaveValue('Proofread twice')
    await expect(page.getByLabel('Due date')).toHaveValue('2031-02-03')
  })

  test('clearing the description and due date removes them', async ({ page }) => {
    await signUpAndLogin(page)
    const { boardId } = await seedBoard(page.request, 'B', { 'To do': ['Task'] })
    await page.goto(`/boards/${boardId}`)
    await card(page, 'Task').click()
    await page.getByLabel('Description').fill('temp')
    await page.getByLabel('Due date').fill('2031-02-03')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(card(page, 'Task')).toContainText('2031-02-03')

    await card(page, 'Task').click()
    await page.getByLabel('Description').fill('   ')
    await page.getByLabel('Due date').fill('')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(card(page, 'Task')).not.toContainText('2031')
    await page.reload()
    await card(page, 'Task').click()
    await expect(page.getByLabel('Description')).toHaveValue('')
    await expect(page.getByLabel('Due date')).toHaveValue('')
  })

  test('delete a card after confirming', async ({ page }) => {
    await signUpAndLogin(page)
    const { boardId } = await seedBoard(page.request, 'B', { 'To do': ['Keep me', 'Remove me'] })
    await page.goto(`/boards/${boardId}`)

    await card(page, 'Remove me').click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.getByText('Delete "Remove me"?')).toBeVisible()
    await page.getByRole('button', { name: 'Delete card' }).click()

    await expectTitles(page, 'To do', ['Keep me'])
    await page.reload()
    await expectTitles(page, 'To do', ['Keep me'])
  })

  test('a card needs a title', async ({ page }) => {
    await signUpAndLogin(page)
    const { boardId } = await seedBoard(page.request, 'B', { 'To do': [] })
    await page.goto(`/boards/${boardId}`)

    await column(page, 'To do').getByRole('button', { name: 'Add card' }).click()
    await expect(column(page, 'To do').locator('ul > li')).toHaveCount(0)
  })
})
