import { describe, expect, it } from 'vitest'

import { snapToGrid } from '@/lib/tile-snap'

const GRID = { x: 20, y: 300 }
const BOARD = { x: 0, y: 100 }

describe('snapToGrid', () => {
  it("puts a target on the cell nearest to it, in the board's own coordinates", () => {
    // Window (31, 190) is nearest the cell at x 20, y 220 (grid y 300 less 80)
    const spot = snapToGrid({
      at: { x: 31, y: 90 },
      board: BOARD,
      grid: GRID,
      size: 80,
      width: 400,
    })
    expect(spot).toEqual({ x: 20, y: 120 })
  })

  it('moves a cell that hangs off the edge a whole cell in', () => {
    const spot = snapToGrid({
      at: { x: 360, y: 90 },
      board: BOARD,
      grid: GRID,
      size: 80,
      width: 400,
    })
    expect(spot.x + 80).toBeLessThanOrEqual(400)
  })

  it('keeps two targets a cell apart in different cells', () => {
    const a = snapToGrid({
      at: { x: 100, y: 40 },
      board: BOARD,
      grid: GRID,
      size: 80,
      width: 400,
    })
    const b = snapToGrid({
      at: { x: 180, y: 40 },
      board: BOARD,
      grid: GRID,
      size: 80,
      width: 400,
    })
    expect(a).not.toEqual(b)
  })
})
