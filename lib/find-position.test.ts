import { describe, expect, it } from 'vitest'

import { clampToContainer, fitsContainer } from './find-position'

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

// The canvas a card was placed against is not always the one it lives in: the tutorial's
// stepper and band arrive with the run and take 90 points off the board below them.
describe('clampToContainer', () => {
  it('leaves a card the canvas still has room for alone', () => {
    expect(clampToContainer({ x: 20, y: 30 }, 400, 600)).toEqual({ x: 20, y: 30 })
  })

  it('pulls a card off the bottom edge back inside', () => {
    expect(clampToContainer({ x: 20, y: 580 }, 400, 600)).toEqual({ x: 20, y: 510 })
  })

  it('pulls a card off the right edge back inside', () => {
    expect(clampToContainer({ x: 380, y: 30 }, 400, 600)).toEqual({ x: 310, y: 30 })
  })

  it('keeps the tutorial opening target clear of the sum row', () => {
    // Placed against the canvas as the menu left it, then the stepper (34) and the
    // talking band (56) arrive under the run and the board is 90 points shorter.
    const placed = { x: 100, y: 430 }
    expect(fitsContainer(placed, 400, 520)).toBe(true)
    expect(fitsContainer(placed, 400, 430)).toBe(false)
    expect(fitsContainer(clampToContainer(placed, 400, 430), 400, 430)).toBe(true)
  })

  it('holds a card on the board when there is no room to hold it off the edges', () => {
    expect(clampToContainer({ x: 40, y: 40 }, 50, 50)).toEqual({ x: 0, y: 0 })
  })

  it('leaves a card where it is while the board has not been measured', () => {
    expect(clampToContainer({ x: 900, y: 900 }, 0, 0)).toEqual({ x: 900, y: 900 })
  })
})
