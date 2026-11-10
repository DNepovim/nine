import { describe, expect, it } from 'vitest'

import { TILE_LEVELS, tileAt, TOP_LEVEL } from '@/lib/tile-motif'

const weight = (index: number, level: number) => {
  const { fill, stroke } = tileAt(index, level)
  return fill.length + stroke.length
}

describe('tile motifs', () => {
  it('paints more on every level than on the one below', () => {
    for (let index = 0; index < 4; index += 1) {
      for (let level = 1; level < TILE_LEVELS; level += 1) {
        expect(weight(index, level), `${index}@${level}`).toBeGreaterThan(
          weight(index, level - 1),
        )
      }
    }
  })

  it('gives sixteen tiles of the top level no two alike', () => {
    const drawn = Array.from({ length: 16 }, (_, i) =>
      JSON.stringify(tileAt(i, TOP_LEVEL)),
    )
    expect(new Set(drawn).size).toBe(16)
  })

  it('clamps a level outside its range', () => {
    expect(tileAt(0, -3)).toEqual(tileAt(0, 0))
    expect(tileAt(0, 40)).toEqual(tileAt(0, TOP_LEVEL))
  })

  it("draws only finite numbers, and paints a wall tile's middle too", () => {
    for (let level = 0; level < TILE_LEVELS; level += 1) {
      const { fill, stroke } = tileAt(5, level, true)
      expect(fill + stroke).not.toMatch(/NaN|Infinity|undefined/)
    }
    expect(weight(0, 0)).toBeLessThan(
      tileAt(0, 0, true).fill.length + tileAt(0, 0, true).stroke.length,
    )
  })
})
