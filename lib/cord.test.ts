import { describe, expect, it } from 'vitest'

import { cordOffset, cordPath } from './cord'

describe('cordOffset', () => {
  it('never moves the fixing', () => {
    expect(cordOffset(0, 1, 0.3)).toBeCloseTo(0)
  })

  it('hangs straight with no sway and the wave spent', () => {
    for (const along of [0.25, 0.5, 1]) expect(cordOffset(along, 0, 1)).toBe(0)
  })

  it('swings further towards the foot, either way', () => {
    expect(cordOffset(1, 1, 1)).toBeGreaterThan(cordOffset(0.5, 1, 1))
    expect(cordOffset(1, -1, 1)).toBe(-cordOffset(1, 1, 1))
  })

  it('starts a wave from where the foot already stands', () => {
    expect(cordOffset(1, 0, 0)).toBeCloseTo(0)
  })

  it('bends the cord while the wave runs, and less as it dies', () => {
    const early = Math.abs(cordOffset(0.9, 0, 0.1))
    const late = Math.abs(cordOffset(0.9, 0, 0.9))
    expect(early).toBeGreaterThan(0)
    expect(late).toBeLessThan(early)
  })
})

describe('cordPath', () => {
  it('runs from the fixing to the foot at the length asked for', () => {
    const path = cordPath(16, 200, 0, 1)
    expect(path.startsWith('M 16 0 L')).toBe(true)
    expect(path.endsWith('L 16.00 200.00')).toBe(true)
  })
})
