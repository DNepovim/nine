import { describe, expect, it } from 'vitest'

import { arrowsD, dimensionD, DRAW, edgesOf, frameD, phaseOf } from '@/lib/dial-sketch'

describe('edgesOf', () => {
  it('stands the cuts along the span, edge to edge', () => {
    expect(edgesOf([0.25, 0.75], 0, 2, 200)).toEqual([0, 50, 200])
  })

  it('reads its shares from where the axis starts in the cut', () => {
    expect(edgesOf([0.5, 0.5, 0.25, 0.75], 2, 2, 100)).toEqual([0, 25, 100])
  })
})

describe('frameD', () => {
  it('rules every cut and both edges, each way', () => {
    const d = frameD([0, 50, 200], [0, 80, 200])
    // Three lines across and three down.
    expect(d.match(/M/g)).toHaveLength(6)
  })

  it('carries each rule past where it meets the next', () => {
    expect(frameD([0, 100], [0, 100])).toContain('M-7 0L107 0')
  })

  it('lays a second stroke beside the first when it is moved', () => {
    expect(frameD([0, 100], [0, 100], 1, 2)).toContain('M-6 2L108 2')
  })
})

describe('dimensions', () => {
  it('draws an extension line off every cut and a dimension line between each two', () => {
    const d = dimensionD([0, 50, 200], [0, 80, 200])
    // Three extension lines each way, two dimension lines each way.
    expect(d.match(/M/g)).toHaveLength(10)
  })

  it('puts an arrowhead at both ends of every dimension line', () => {
    const d = arrowsD([0, 50, 200], [0, 80, 200])
    expect(d.match(/Z/g)).toHaveLength(8)
  })
})

describe('phaseOf', () => {
  it('is how far through its stretch of the sweep the drawing is', () => {
    expect(phaseOf(0, DRAW.cuts)).toBe(0)
    expect(phaseOf(0.425, DRAW.cuts)).toBeCloseTo(0.5)
    expect(phaseOf(1, DRAW.cuts)).toBe(1)
  })
})

describe('a drawing in the making', () => {
  it('rules nothing before it has begun, and not a dot either', () => {
    expect(frameD([0, 100], [0, 100], 0, 0, 0, 0)).toBe('')
    expect(dimensionD([0, 100], [0, 100], 0)).toBe('')
  })

  it('rules the edges before the cuts', () => {
    const d = frameD([0, 50, 100], [0, 50, 100], 0, 0, 1, 0)
    // Two edges each way, no cut.
    expect(d.match(/M/g)).toHaveLength(4)
  })

  it('draws a line as far as it has got', () => {
    expect(frameD([0, 100], [0, 100], 0, 0, 0.5, 0)).toContain('M-7 0L50 0')
  })
})
