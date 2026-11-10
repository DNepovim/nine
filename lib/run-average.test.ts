import { describe, expect, it } from 'vitest'

import { averageOf, headingOf } from '@/lib/run-average'

describe('averageOf', () => {
  it('is the figure over the hits, as a whole percent', () => {
    expect(averageOf(1.5, 2)).toBe(75)
    expect(averageOf(2, 3)).toBe(67)
  })

  it('is nothing for a run with no hit', () => {
    expect(averageOf(0, 0)).toBe(0)
    expect(averageOf(3, 0)).toBe(0)
  })
})

describe('headingOf', () => {
  it('is up for a figure that rose and down for one that fell', () => {
    expect(headingOf(80, 70)).toBe(1)
    expect(headingOf(60, 70)).toBe(-1)
  })

  it('reads a figure that held still as down, which no caller shows', () => {
    expect(headingOf(70, 70)).toBe(-1)
  })
})
