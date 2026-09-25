import { describe, expect, it } from 'vitest'

import { fitsContainer } from './find-position'

// PIE_SIZE is 80, so a card at x takes the board out to x + 80.
describe('fitsContainer', () => {
  it('keeps a spot well inside the board', () => {
    expect(fitsContainer({ x: 20, y: 30 }, 400, 600)).toBe(true)
  })

  it('keeps a spot that ends exactly on the edge', () => {
    expect(fitsContainer({ x: 320, y: 520 }, 400, 600)).toBe(true)
  })

  it('refuses a spot hanging off the right edge', () => {
    expect(fitsContainer({ x: 390, y: 30 }, 400, 600)).toBe(false)
  })

  it('refuses a spot hanging off the bottom', () => {
    expect(fitsContainer({ x: 20, y: 590 }, 400, 600)).toBe(false)
  })

  it('refuses a spot off the top or the left', () => {
    expect(fitsContainer({ x: -1, y: 30 }, 400, 600)).toBe(false)
    expect(fitsContainer({ x: 20, y: -1 }, 400, 600)).toBe(false)
  })

  it('accepts anything while the board has not been measured', () => {
    expect(fitsContainer({ x: 900, y: 900 }, 0, 0)).toBe(true)
  })
})
