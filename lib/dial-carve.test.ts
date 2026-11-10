import { describe, expect, it } from 'vitest'

import {
  carvedCellAt,
  carveOf,
  cellRect,
  laneTotals,
  type CellRect,
} from '@/lib/dial-carve'
import { dialMetrics } from '@/lib/dial-metrics'
import { defineDial } from '@/modes'

const FOUR = defineDial({
  id: 'four',
  rows: 2,
  cols: 2,
  weights: [1, 2, 2, 4],
  proportional: true,
})

// The box the dial occupies on a phone 390 wide, which is 244 square with a gap of 16.
const METRICS = dialMetrics({ width: 390, height: 844 }, FOUR)

describe('carveOf', () => {
  it('cuts a row by the weighted digits it holds, over the whole', () => {
    // Top row 3·1 + 2·2 = 7, bottom row 2·2 + 3·4 = 16: the top is 7 of 23.
    const [top, bottom] = carveOf(FOUR, [3, 2, 2, 3])
    expect(top).toBeCloseTo(7 / 23)
    expect(bottom).toBeCloseTo(16 / 23)
  })

  it('cuts a column the same way', () => {
    // Left column 3·1 + 2·2 = 7, right column 2·2 + 3·4 = 16.
    const [, , left, right] = carveOf(FOUR, [3, 2, 2, 3])
    expect(left).toBeCloseTo(7 / 23)
    expect(right).toBeCloseTo(16 / 23)
  })

  it('cuts the square into 1, 2, 2 and 4 when every key stands on the same digit', () => {
    for (const digit of [0, 1, 7]) {
      const [top, bottom, left, right] = carveOf(FOUR, [digit, digit, digit, digit])
      expect(top).toBeCloseTo(1 / 3)
      expect(bottom).toBeCloseTo(2 / 3)
      expect(left).toBeCloseTo(1 / 3)
      expect(right).toBeCloseTo(2 / 3)
    }
  })

  it('never lets a lane shrink to nothing', () => {
    // The top row holds nothing at all, and would be no row.
    const [top, bottom, left, right] = carveOf(FOUR, [0, 0, 0, 9])
    expect(top).toBeCloseTo(0.2)
    expect(bottom).toBeCloseTo(0.8)
    expect(left).toBeCloseTo(0.2)
    expect(right).toBeCloseTo(0.8)
  })

  it('adds up to one in each direction', () => {
    const [top = 0, bottom = 0, left = 0, right = 0] = carveOf(FOUR, [9, 0, 4, 2])
    expect(top + bottom).toBeCloseTo(1)
    expect(left + right).toBeCloseTo(1)
  })
})

describe('cellRect', () => {
  it('fills the box between the gaps', () => {
    const carve = carveOf(FOUR, [3, 1, 2, 5])
    const [a, b, c, d] = [0, 1, 2, 3].map((i) => cellRect(i, carve, METRICS, FOUR)) as [
      CellRect,
      CellRect,
      CellRect,
      CellRect,
    ]
    // Side by side with one gap between, and the same for the rows.
    expect(a.x + a.width + METRICS.gap).toBeCloseTo(b.x)
    expect(a.y + a.height + METRICS.gap).toBeCloseTo(c.y)
    expect(d.x + d.width).toBeCloseTo(METRICS.width)
    expect(d.y + d.height).toBeCloseTo(METRICS.height)
  })

  it('stands as the pieces of (1 + 2)² at rest, the big one four times the small', () => {
    const carve = carveOf(FOUR, [0, 0, 0, 0])
    const small = cellRect(0, carve, METRICS, FOUR)
    const large = cellRect(3, carve, METRICS, FOUR)
    expect((large.width * large.height) / (small.width * small.height)).toBeCloseTo(4)
  })
})

describe('on a dial with no space between its keys', () => {
  const FLUSH = { ...METRICS, gap: 0 }

  it('has keys that share their edges and fill the box', () => {
    const carve = carveOf(FOUR, [3, 2, 2, 3])
    const a = cellRect(0, carve, FLUSH, FOUR)
    const b = cellRect(1, carve, FLUSH, FOUR)
    const c = cellRect(2, carve, FLUSH, FOUR)
    expect(a.x + a.width).toBeCloseTo(b.x)
    expect(a.y + a.height).toBeCloseTo(c.y)
    expect(b.x + b.width).toBeCloseTo(FLUSH.width)
  })

  it('gives each point to the key it is in, right up to the cut', () => {
    const carve = carveOf(FOUR, [3, 2, 2, 3])
    const left = cellRect(0, carve, FLUSH, FOUR)
    expect(carvedCellAt(left.width - 0.1, 5, carve, FLUSH, FOUR)).toBe(0)
    expect(carvedCellAt(left.width + 0.1, 5, carve, FLUSH, FOUR)).toBe(1)
  })
})

describe('laneTotals', () => {
  it('adds up what each row and column holds, digit times weight', () => {
    expect(laneTotals(FOUR, [3, 2, 2, 3])).toEqual({ rows: [7, 16], cols: [7, 16] })
  })
})

describe('carvedCellAt', () => {
  it('finds the key whose box holds the point, wherever the cuts stand', () => {
    for (const grid of [
      [0, 0, 0, 0],
      [3, 1, 2, 5],
      [0, 0, 0, 9],
      [9, 9, 0, 0],
    ]) {
      const carve = carveOf(FOUR, grid)
      for (const index of [0, 1, 2, 3]) {
        const rect = cellRect(index, carve, METRICS, FOUR)
        const middle = carvedCellAt(
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
          carve,
          METRICS,
          FOUR,
        )
        expect(middle).toBe(index)
      }
    }
  })

  it('gives the gap between two keys to one of them', () => {
    const carve = carveOf(FOUR, [3, 1, 2, 5])
    const left = cellRect(0, carve, METRICS, FOUR)
    const inGap = carvedCellAt(
      left.x + left.width + METRICS.gap / 2 - 0.1,
      10,
      carve,
      METRICS,
      FOUR,
    )
    const pastGap = carvedCellAt(
      left.x + left.width + METRICS.gap / 2 + 0.1,
      10,
      carve,
      METRICS,
      FOUR,
    )
    expect(inGap).toBe(0)
    expect(pastGap).toBe(1)
  })

  it('finds nothing outside the box', () => {
    const carve = carveOf(FOUR, [0, 0, 0, 0])
    expect(carvedCellAt(-1, 10, carve, METRICS, FOUR)).toBeNull()
    expect(carvedCellAt(10, METRICS.height, carve, METRICS, FOUR)).toBeNull()
  })
})
