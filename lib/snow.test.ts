import { describe, expect, it } from 'vitest'

import { flurry } from '@/lib/snow'

describe('flurry', () => {
  it('is the same snow for the same seed and another for a different one', () => {
    expect(flurry(3, 20)).toEqual(flurry(3, 20))
    expect(flurry(3, 20)).not.toEqual(flurry(4, 20))
  })

  it('spreads its flakes across the screen in order, each on a column of its own', () => {
    const flakes = flurry(3, 20)
    expect(flakes).toHaveLength(20)
    const xs = flakes.map((flake) => flake.x)
    expect(xs).toEqual([...xs].sort((a, b) => a - b))
    expect(Math.min(...xs)).toBeGreaterThan(0)
    expect(Math.max(...xs)).toBeLessThan(1)
    expect(new Set(xs).size).toBe(20)
  })

  it('lets the nearer, bigger flakes fall quicker', () => {
    const flakes = flurry(3, 40)
    const sizes = flakes.map((flake) => flake.size)
    const biggest = flakes.find((flake) => flake.size === Math.max(...sizes))
    const smallest = flakes.find((flake) => flake.size === Math.min(...sizes))
    expect(biggest?.period).toBeLessThan(smallest?.period ?? 0)
  })
})
