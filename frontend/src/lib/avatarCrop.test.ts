import { describe, expect, it } from 'vitest'
import { layout } from './avatarCrop'

describe('layout', () => {
  it('landscape image at zoom 1 fills the square height and is centred', () => {
    const l = layout(400, 200, { zoom: 1, cx: 0.5, cy: 0.5 }, 100)
    expect(l.dh).toBe(100)
    expect(l.dw).toBe(200)
    expect(l.x).toBe(-50)
    expect(l.y).toBe(0)
  })

  it('portrait image fills the square width', () => {
    const l = layout(200, 400, { zoom: 1, cx: 0.5, cy: 0.5 }, 100)
    expect(l.dw).toBe(100)
    expect(l.dh).toBe(200)
  })

  it('zoom enlarges the image', () => {
    expect(layout(100, 100, { zoom: 2, cx: 0.5, cy: 0.5 }, 100).dw).toBe(200)
  })

  it('never lets the image leave a gap at any edge', () => {
    const far = layout(400, 200, { zoom: 1, cx: -5, cy: 9 }, 100)
    expect(far.x).toBeLessThanOrEqual(0)
    expect(far.x + far.dw).toBeGreaterThanOrEqual(100)
    expect(far.y).toBeLessThanOrEqual(0)
    expect(far.y + far.dh).toBeGreaterThanOrEqual(100)
    const near = layout(400, 200, { zoom: 3, cx: 0, cy: 0 }, 100)
    expect(near.x).toBe(0)
    expect(near.y).toBe(0)
  })
})
