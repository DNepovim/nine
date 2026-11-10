import { describe, expect, it } from 'vitest'

import { planksOf } from '@/lib/herringbone'

describe('planksOf', () => {
  // Rasterised on the plank-width grid, which every plank edge lies on: each cell well inside
  // the floor must be covered by exactly one plank.
  it.each([2, 3, 4])(
    'tiles the floor with no gap and no overlap at ratio %i',
    (ratio) => {
      const width = 1
      const span = 24
      const covered = new Map<string, number>()
      for (const plank of planksOf(span, width, ratio)) {
        for (let x = plank.x; x < plank.x + plank.width; x++) {
          for (let y = plank.y; y < plank.y + plank.height; y++) {
            const key = `${x},${y}`
            covered.set(key, (covered.get(key) ?? 0) + 1)
          }
        }
      }
      for (let x = 0; x < span; x++) {
        for (let y = 0; y < span; y++) {
          expect(covered.get(`${x},${y}`), `${x},${y}`).toBe(1)
        }
      }
    },
  )
})
