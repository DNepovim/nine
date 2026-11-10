import { describe, expect, it } from 'vitest'

import { dancerOf, OUTFITS } from '@/lib/dancers'

describe('dancerOf', () => {
  it('dresses and turns a dancer the same every time', () => {
    expect(dancerOf(4)).toEqual(dancerOf(4))
  })

  it('keeps every turn inside one circle, for any sequence number', () => {
    for (const seq of [-3, 0, 1, 8, 400]) {
      const { turn } = dancerOf(seq)
      expect(turn).toBeGreaterThanOrEqual(0)
      expect(turn).toBeLessThan(360)
    }
  })

  it('turns neighbours in the deal to different ways', () => {
    const turns = new Set(Array.from({ length: 9 }, (_, seq) => dancerOf(seq).turn))
    expect(turns.size).toBe(9)
  })

  it('draws every outfit from the palette', () => {
    for (let seq = 0; seq < 12; seq++) {
      expect(OUTFITS).toContain(dancerOf(seq).outfit)
    }
  })
})
