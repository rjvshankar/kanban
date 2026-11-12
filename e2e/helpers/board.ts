// UI helpers for the board page: locating columns/cards and dragging with dnd-kit.
import { expect, type Locator, type Page } from '@playwright/test'

export const column = (page: Page, name: string) => page.locator('section').filter({ has: page.getByRole('heading', { name, exact: true }) })

// dnd-kit sets role="button" on each card <li>, so cards cannot be found by the "listitem" role.
export const card = (page: Page, title: string) => page.locator('section ul > li').filter({ hasText: title })

/** Titles of the cards in a column, top to bottom. */
export const cardTitles = (page: Page, columnName: string) => column(page, columnName).locator('ul > li > div > div:first-child')

/** Names of the columns, left to right. */
export const columnNames = (page: Page) => page.locator('section h2')

/**
 * Drags with real mouse events, the way a person does: grab, start moving (dnd-kit's mouse sensor needs ~5px),
 * move onto the target, wait for the neighbours to slide aside, then release.
 *
 * - Within one list, items only *visually* shift (CSS transforms); dnd-kit still decides what you are hovering
 *   from each item's original box, so aim at the target where it started (the default).
 * - Into a different column the board really inserts the card into that column's list, which moves the
 *   layout. Pass `intoOtherColumn` to measure the target again after entering it and aim at its new spot.
 *
 * Resolves once the move has been saved (pass `expectSave: false` for drags that must not save, e.g. a viewer's).
 *
 * `dy` offsets the drop point from the target's centre (positive = lower half). The source is grabbed near its
 * top edge: the board inserts "after" a card only once the dragged card's top edge passes that card's midpoint.
 */
export async function drag(
  page: Page, source: Locator, target: Locator,
  opts: { dx?: number; dy?: number; grab?: 'top' | 'center'; intoOtherColumn?: boolean; expectSave?: boolean } = {},
) {
  const centre = (b: { x: number; y: number; width: number; height: number }) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 })
  const from = (await source.boundingBox())!
  const startX = from.x + from.width / 2
  const startY = opts.grab === 'center' ? from.y + from.height / 2 : from.y + 6
  const first = centre((await target.boundingBox())!)

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + 10, startY + 8, { steps: 5 }) // pass the activation distance
  await page.mouse.move(first.x, first.y, { steps: 20 })
  await page.waitForTimeout(250) // let dnd-kit open the slot and animate the neighbours aside

  const aim = opts.intoOtherColumn ? centre((await target.boundingBox())!) : first
  await page.mouse.move(aim.x + (opts.dx ?? 0), aim.y + (opts.dy ?? 0), { steps: 10 })
  await page.waitForTimeout(250) // the hovered item must be final before releasing

  // The board shows the new order instantly, *before* the server has saved it. Wait for the save, otherwise a test
  // that reloads right after the drop aborts the in-flight request and sees the old order.
  const saved = opts.expectSave === false ? null : page.waitForResponse((r) => r.request().method() === 'POST' && /\/api\/(cards|columns)\/\d+\/move$/.test(r.url()))
  await page.mouse.up()
  const res = await saved
  if (res) expect(res.status(), 'the move request should succeed').toBe(204)
}

/** Waits until the page has finished saving a drop (the board refetches and the DOM settles). */
export async function expectTitles(page: Page, columnName: string, titles: string[]) {
  await expect(cardTitles(page, columnName)).toHaveText(titles)
}

/**
 * Opens a board and waits until the page is subscribed to live updates (WebSocket up and the board joined),
 * so a change made by someone else right after this cannot be missed.
 */
export async function gotoBoardLive(page: Page, boardId: number) {
  const socket = page.waitForEvent('websocket', { predicate: (ws) => ws.url().includes('/hubs/board') })
  await page.goto(`/boards/${boardId}`)
  await socket
  await page.waitForTimeout(400) // the JoinBoard round trip on the open socket
}
