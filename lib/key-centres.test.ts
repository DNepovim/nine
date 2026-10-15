import { describe, expect, it } from 'vitest'

import { keyCentres } from './strike-shot'

// The dial a quartet is fired from: 2x2, which is `challenge/four-keys`.
const FOUR = { rows: 2, cols: 2 }

describe('keyCentres', () => {
  it('puts a centre in the middle of each cell', () => {
    expect(keyCentres({ x: 0, y: 0, width: 100, height: 100 }, FOUR)).toEqual([
      { x: 25, y: 25 },
      { x: 75, y: 25 },
      { x: 25, y: 75 },
      { x: 75, y: 75 },
    ])
  })

  it('carries the box’s own offset, since the layer is not the dial', () => {
    expect(keyCentres({ x: 10, y: 200, width: 100, height: 100 }, FOUR)).toEqual([
      { x: 35, y: 225 },
      { x: 85, y: 225 },
      { x: 35, y: 275 },
      { x: 85, y: 275 },
    ])
  })

  it('walks row-major, the order a Grid is in', () => {
    const wide = keyCentres({ x: 0, y: 0, width: 120, height: 40 }, { rows: 1, cols: 4 })
    expect(wide.map((p) => p.x)).toEqual([15, 45, 75, 105])
    expect(wide.every((p) => p.y === 20)).toBe(true)
  })

  it('answers for the nine every other mode is played on', () => {
    expect(
      keyCentres({ x: 0, y: 0, width: 90, height: 90 }, { rows: 3, cols: 3 }),
    ).toHaveLength(9)
  })

  it('is empty before the dial has been measured', () => {
    // The shot layer reads this as "no muzzles" and fires the single beam from the sum
    // row instead, so a strike in the first frames of a run is drawn rather than lost.
    expect(keyCentres({ x: 0, y: 0, width: 0, height: 0 }, FOUR)).toEqual([])
    expect(keyCentres({ x: 0, y: 0, width: 100, height: 0 }, FOUR)).toEqual([])
  })
})
