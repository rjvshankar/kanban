import { expect, test, type Browser, type Page } from '@playwright/test'
import { addMember, login, registerUser, seedBoard, signUpAndLogin, type TestUser } from '../helpers/api'
import { card, column } from '../helpers/board'

type Role = 'owner' | 'editor' | 'viewer'

/** A board owned by one user, with the other two roles added as members, each with their own browser session. */
async function boardWithAllRoles(browser: Browser, page: Page) {
  const owner = await signUpAndLogin(page, 'Owner')
  const { boardId, columnIds } = await seedBoard(page.request, 'Roles', { 'To do': ['Task one'], Done: [] })
  const users: Record<Role, { user: TestUser; page: Page }> = { owner: { user: owner, page }, } as never
  for (const role of ['editor', 'viewer'] as const) {
    const user = await registerUser(page.request, role)
    await addMember(page.request, boardId, user, role)
    const ctx = await browser.newContext()
    const p = await ctx.newPage()
    await login(p.request, user)
    users[role] = { user, page: p }
  }
  return { boardId, columnIds, users }
}

test.describe('what each role can do in the UI', () => {
  test('owner, editor and viewer see exactly the controls their role allows', async ({ page, browser }) => {
    const { boardId, users } = await boardWithAllRoles(browser, page)

    const expectations: Record<Role, { ownerControls: boolean; cardControls: boolean }> = {
      owner: { ownerControls: true, cardControls: true },
      editor: { ownerControls: false, cardControls: true },
      viewer: { ownerControls: false, cardControls: false },
    }
    for (const role of ['owner', 'editor', 'viewer'] as const) {
      const p = users[role].page
      const want = expectations[role]
      await p.goto(`/boards/${boardId}`)
      await expect(p.getByRole('heading', { name: 'Roles' })).toBeVisible()
      await expect(p.locator('header')).toContainText(role)

      const visibility = (n: number) => (want.ownerControls ? expect(n).toBeGreaterThan(0) : expect(n).toBe(0))
      visibility(await p.getByLabel('Rename board').count())
      visibility(await p.getByRole('button', { name: /members/i }).count())
      visibility(await p.getByPlaceholder('New column').count())
      visibility(await p.getByLabel('Rename column').count())
      visibility(await p.getByLabel('Delete column').count())
      visibility(await p.getByLabel('Drag column').count())
      const addCard = await p.getByPlaceholder('Add a card').count()
      if (want.cardControls) expect(addCard).toBe(2)
      else expect(addCard).toBe(0)
    }
    for (const role of ['editor', 'viewer'] as const) await users[role].page.context().close()
  })

  test('an editor can add and edit cards; a viewer can only read them', async ({ page, browser }) => {
    const { boardId, users } = await boardWithAllRoles(browser, page)

    const editor = users.editor.page
    await editor.goto(`/boards/${boardId}`)
    await column(editor, 'Done').getByPlaceholder('Add a card').fill('From the editor')
    await column(editor, 'Done').getByRole('button', { name: 'Add card' }).click()
    await expect(card(editor, 'From the editor')).toBeVisible()
    await card(editor, 'Task one').click()
    await editor.getByLabel('Title').fill('Edited by editor')
    await editor.getByRole('button', { name: 'Save' }).click()
    await expect(card(editor, 'Edited by editor')).toBeVisible()

    const viewer = users.viewer.page
    await viewer.goto(`/boards/${boardId}`)
    await expect(card(viewer, 'Edited by editor')).toBeVisible()
    // dnd-kit marks a viewer's cards aria-disabled (they cannot be dragged) although clicking still opens the read-only view
    await card(viewer, 'Edited by editor').click({ force: true })
    const dialog = viewer.getByRole('dialog', { name: 'Card' })
    await expect(dialog.getByLabel('Title')).toBeDisabled()
    await expect(dialog.getByRole('button', { name: 'Save' })).toHaveCount(0)
    await expect(dialog.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0)

    for (const role of ['editor', 'viewer'] as const) await users[role].page.context().close()
  })
})

test.describe('the server enforces roles even when the UI is bypassed', () => {
  test('direct API calls are rejected by role, and hidden from non-members', async ({ page, browser }) => {
    const { boardId, columnIds, users } = await boardWithAllRoles(browser, page)
    const stranger = await browser.newContext()
    const strangerPage = await stranger.newPage()
    await signUpAndLogin(strangerPage, 'Stranger')

    const post = (p: Page, path: string, data: object) => p.request.post(path, { data })
    const col = columnIds['To do']

    // viewer: read yes, write no
    expect((await users.viewer.page.request.get(`/api/boards/${boardId}`)).status()).toBe(200)
    expect((await post(users.viewer.page, `/api/columns/${col}/cards`, { title: 'x' })).status()).toBe(403)
    // editor: cards yes, columns / board settings / members no
    expect((await post(users.editor.page, `/api/columns/${col}/cards`, { title: 'ok' })).status()).toBe(201)
    expect((await post(users.editor.page, `/api/boards/${boardId}/columns`, { name: 'x' })).status()).toBe(403)
    expect((await users.editor.page.request.patch(`/api/boards/${boardId}`, { data: { name: 'x' } })).status()).toBe(403)
    expect((await users.editor.page.request.delete(`/api/boards/${boardId}`)).status()).toBe(403)
    expect((await users.editor.page.request.get(`/api/boards/${boardId}/members`)).status()).toBe(403)
    // non-member: indistinguishable from a board that does not exist
    expect((await strangerPage.request.get(`/api/boards/${boardId}`)).status()).toBe(404)
    expect((await post(strangerPage, `/api/columns/${col}/cards`, { title: 'x' })).status()).toBe(404)
    // nobody without a login
    const anon = await browser.newContext()
    expect((await anon.request.get(`/api/boards/${boardId}`)).status()).toBe(401)

    for (const c of [users.editor.page.context(), users.viewer.page.context(), stranger, anon]) await c.close()
  })
})
