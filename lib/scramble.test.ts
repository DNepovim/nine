import { describe, expect, it } from 'vitest'

import { idSeed, seeded } from '@/lib/rng'
import { scrambleGrid } from '@/lib/scramble'
import { defineDial, NINE_DIAL, sumOf, type DialSpec, type Grid } from '@/modes'

const FOUR = defineDial({ id: 'four', rows: 2, cols: 2, weights: [1, 2, 2, 4] })
const SIXTEEN = defineDial({ id: 'sixteen', rows: 4, cols: 4 })

const everyKeyMoved = (from: Grid, to: Grid) => to.every((value, i) => value !== from[i])

// A grid of its own for each seed, so the property is checked from many positions rather
// than from one.
const gridFor = (dial: DialSpec, seed: number): Grid => {
  const rng = seeded(seed)
  return dial.weights.map(() => Math.floor(rng() * dial.digits))
}

describe('scrambleGrid', () => {
  it.each([
    ['nine', NINE_DIAL],
    ['four', FOUR],
    ['sixteen', SIXTEEN],
  ])('moves every key and lands on no standing number (%s)', (_name, dial) => {
    for (let seed = 0; seed < 1000; seed++) {
      const rng = seeded(idSeed(`test:${seed}`))
      const grid = gridFor(dial, seed)
      // One to four numbers standing, drawn from the dial's own range.
      const avoid = Array.from({ length: 1 + (seed % 4) }, () =>
        Math.floor(rng() * (dial.maxSum + 1)),
      )
      const next = scrambleGrid(dial, grid, avoid, rng)
      expect(everyKeyMoved(grid, next)).toBe(true)
      expect(avoid).not.toContain(sumOf(dial, next))
      expect(next.every((value) => value >= 0 && value < dial.digits)).toBe(true)
    }
  })

  it('never puts the key a press moved back on the digit it showed before it', () => {
    // The ×9 key went 3 → 4 to make the hit. Landing it back on 3 would read as the swipe
    // being undone; it may be anything but 3 and 4.
    const before = [0, 0, 0, 0, 0, 0, 0, 0, 3]
    const dialled = [0, 0, 0, 0, 0, 0, 0, 0, 4]
    for (let seed = 0; seed < 1000; seed++) {
      const next = scrambleGrid(NINE_DIAL, dialled, [], seeded(seed), before)
      expect(next[8]).not.toBe(3)
      expect(everyKeyMoved(dialled, next)).toBe(true)
    }
  })

  it('gives the same grid for the same seed', () => {
    const grid = [3, 0, 7, 2, 9, 4, 1, 5, 8]
    const once = scrambleGrid(NINE_DIAL, grid, [100], seeded(42))
    const again = scrambleGrid(NINE_DIAL, grid, [100], seeded(42))
    expect(again).toEqual(once)
  })

  it('steps its way clear when every draw lands on a standing number', () => {
    // An rng stuck at nought moves every key up by one, every time: from all zeros that is
    // all ones, whose sum is the dial's weights added up — 36 on the nine dial.
    const stuck = () => 0
    const grid = new Array<number>(9).fill(0)
    const next = scrambleGrid(NINE_DIAL, grid, [36], stuck)
    expect(everyKeyMoved(grid, next)).toBe(true)
    expect(sumOf(NINE_DIAL, next)).not.toBe(36)
  })

  it('keeps every key moving when no grid can meet both rules', () => {
    // Two digits: the only scramble of [0, 0] is [1, 1], whatever is standing.
    const binary = defineDial({ id: 'binary', rows: 1, cols: 2, digits: 2 })
    const next = scrambleGrid(binary, [0, 0], [sumOf(binary, [1, 1])], seeded(7))
    expect(next).toEqual([1, 1])
  })

  it('hands back a dial whose keys have nowhere to go', () => {
    const fixed = defineDial({ id: 'fixed', rows: 1, cols: 2, digits: 1 })
    expect(scrambleGrid(fixed, [0, 0], [], seeded(1))).toEqual([0, 0])
  })
})
