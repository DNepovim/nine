import { describe, expect, it } from 'vitest'

import { targetBand } from './target-band'

describe('targetBand', () => {
  it('puts values under 100 in band 0', () => {
    expect(targetBand(0)).toBe(0)
    expect(targetBand(99)).toBe(0)
  })

  it('bands by hundreds digit', () => {
    expect(targetBand(100)).toBe(1)
    expect(targetBand(123)).toBe(1)
    expect(targetBand(223)).toBe(2)
    expect(targetBand(300)).toBe(3)
  })

  it('clamps the top of the range to band 3', () => {
    expect(targetBand(324)).toBe(3)
    expect(targetBand(999)).toBe(3)
  })

  it('clamps negatives to band 0', () => {
    expect(targetBand(-50)).toBe(0)
  })
})
