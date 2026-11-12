import { expect, test } from '@playwright/test'
import { addMember, createBoard, login, registerUser, signUpAndLogin } from '../helpers/api'

async function openMembers(page: import('@playwright/test').Page, boardId: number) {
  await page.goto(`/boards/${boardId}`)
  await page.getByRole('button', { name: /members/i }).click()
  const dialog = page.getByRole('dialog', { name: 'Members' })
  await expect(dialog).toBeVisible()
  return dialog
}

test.describe('member management (owner)', () => {
  test('search for a user, add them as viewer, and they can then see the board', async ({ page, browser }) => {
    const owner = await signUpAndLogin(page, 'Owner')
    const boardId = await createBoard(page.request, 'Team board')
    const guest = await registerUser(page.request, 'Guest')

    const dialog = await openMembers(page, boardId)
    await expect(dialog.getByText('(you)')).toBeVisible()
    await expect(dialog.getByText(/Read-only. Can see the board/)).toBeVisible() // role legend

    await dialog.getByPlaceholder('Search by name or email').fill(guest.email)
    await expect(dialog.getByText(`${guest.firstName} ${guest.lastName}`)).toBeVisible()
    await dialog.getByLabel(`Role for ${guest.firstName} ${guest.lastName}`).selectOption('viewer')
    await dialog.getByRole('button', { name: /add/i }).click()

    // They are now a member (and no longer a search candidate).
    await expect(dialog.getByLabel(`Role for ${guest.firstName} ${guest.lastName}`)).toHaveValue('viewer')
    await expect(dialog.getByRole('button', { name: /add/i })).toHaveCount(0)

    const ctx = await browser.newContext()
    const guestPage = await ctx.newPage()
    await login(guestPage.request, guest)
    await guestPage.goto('/')
    const row = guestPage.getByRole('listitem').filter({ hasText: 'Team board' })
    await expect(row).toContainText('viewer')
    await row.getByRole('link').click()
    await expect(guestPage.getByRole('heading', { name: 'Team board' })).toBeVisible()
    expect(owner.id).not.toBe(guest.id)
    await ctx.close()
  })

  test('searching needs two characters and says when nobody matches', async ({ page }) => {
    await signUpAndLogin(page)
    const boardId = await createBoard(page.request, 'B')
    const dialog = await openMembers(page, boardId)

    await dialog.getByPlaceholder('Search by name or email').fill('z')
    await expect(dialog.getByText('No matching users.')).toHaveCount(0)
    await dialog.getByPlaceholder('Search by name or email').fill('zzzz-nobody-has-this-name')
    await expect(dialog.getByText('No matching users.')).toBeVisible()
  })

  test('change a member\'s role and remove them; they gain then lose access', async ({ page, browser }) => {
    await signUpAndLogin(page, 'Owner')
    const boardId = await createBoard(page.request, 'Access board')
    const member = await registerUser(page.request, 'Member')
    await addMember(page.request, boardId, member, 'viewer')
    const name = `${member.firstName} ${member.lastName}`

    const ctx = await browser.newContext()
    const memberPage = await ctx.newPage()
    await login(memberPage.request, member)
    await memberPage.goto(`/boards/${boardId}`)
    await expect(memberPage.getByPlaceholder('Add a card')).toHaveCount(0)

    const dialog = await openMembers(page, boardId)
    await dialog.getByLabel(`Role for ${name}`).selectOption('editor')
    await expect(dialog.getByLabel(`Role for ${name}`)).toHaveValue('editor')
    await memberPage.reload()
    await expect(memberPage.locator('header')).toContainText('editor')

    await dialog.getByLabel(`Remove ${name}`).click()
    await expect(dialog.getByText(name)).toHaveCount(0)
    await memberPage.goto('/')
    await expect(memberPage.getByText('No boards yet. Create one above.')).toBeVisible()
    await memberPage.goto(`/boards/${boardId}`)
    await expect(memberPage.getByText('Board not found.')).toBeVisible()
    await ctx.close()
  })

  test('a board always keeps at least one owner', async ({ page, browser }) => {
    const owner = await signUpAndLogin(page, 'Owner')
    const boardId = await createBoard(page.request, 'Owned')
    const second = await registerUser(page.request, 'Second')
    await addMember(page.request, boardId, second, 'owner')

    // Your own row is read-only in the dialog, so you cannot lock yourself out by accident.
    const dialog = await openMembers(page, boardId)
    await expect(dialog.getByLabel(`Role for ${owner.firstName} ${owner.lastName}`)).toHaveCount(0)
    await expect(dialog.getByLabel(`Remove ${owner.firstName} ${owner.lastName}`)).toHaveCount(0)

    // The second owner demotes the first: allowed, because they remain an owner.
    const ctx = await browser.newContext()
    const secondPage = await ctx.newPage()
    await login(secondPage.request, second)
    const dialog2 = await openMembers(secondPage, boardId)
    await dialog2.getByLabel(`Role for ${owner.firstName} ${owner.lastName}`).selectOption('viewer')
    await expect(dialog2.getByLabel(`Role for ${owner.firstName} ${owner.lastName}`)).toHaveValue('viewer')

    // Now they are the only owner; the server refuses to demote or remove them.
    const demote = await secondPage.request.patch(`/api/boards/${boardId}/members/${second.id}`, { data: { role: 'editor' } })
    expect(demote.status()).toBe(409)
    const remove = await secondPage.request.delete(`/api/boards/${boardId}/members/${second.id}`)
    expect(remove.status()).toBe(409)
    await ctx.close()
  })
})
