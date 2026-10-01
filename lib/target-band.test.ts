import { describe, expect, it } from 'vitest'

import { NINE_DIAL } from '@/modes'

import { targetBand } from './target-band'

describe('targetBand', () => {
  it('puts values under 100 in band 0', () => {
    expect(targetBand(0, NINE_DIAL.maxSum)).toBe(0)
    expect(targetBand(99, NINE_DIAL.maxSum)).toBe(0)
  })

  it('bands by hundreds digit', () => {
    expect(targetBand(100, NINE_DIAL.maxSum)).toBe(1)
    expect(targetBand(123, NINE_DIAL.maxSum)).toBe(1)
    expect(targetBand(223, NINE_DIAL.maxSum)).toBe(2)
    expect(targetBand(300, NINE_DIAL.maxSum)).toBe(3)
  })

  it('clamps the top of the range to band 3', () => {
    expect(targetBand(324, NINE_DIAL.maxSum)).toBe(3)
    expect(targetBand(999, NINE_DIAL.maxSum)).toBe(3)
  })

  it('clamps negatives to band 0', () => {
    expect(targetBand(-50, NINE_DIAL.maxSum)).toBe(0)
  })
})
