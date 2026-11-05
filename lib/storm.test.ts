import { describe, expect, it } from 'vitest'

import { boltForks, boltPoints, rainStreaks, splashSpots } from '@/lib/storm'

describe('boltPoints', () => {
  it('is the same bolt for the same seed and a different one for another', () => {
    expect(boltPoints(7, 120, 400)).toEqual(boltPoints(7, 120, 400))
    expect(boltPoints(7, 120, 400)).not.toEqual(boltPoints(8, 120, 400))
  })

  it('runs from the top of its box to the middle of its foot', () => {
    const points = boltPoints(3, 120, 400)
    expect(points[0]).toEqual({ x: 60, y: 0 })
    expect(points[points.length - 1]).toEqual({ x: 60, y: 400 })
  })

  it('goes only downwards', () => {
    const ys = boltPoints(11, 120, 400).map(({ y }) => y)
    expect(ys).toEqual([...ys].sort((a, b) => a - b))
  })

  it('still reaches its foot from a box too short for many legs', () => {
    expect(boltPoints(1, 120, 10).length).toBeGreaterThanOrEqual(3)
  })
})

describe('boltForks', () => {
  const trunk = boltPoints(3, 320, 500)

  it('is the same forks for the same seed', () => {
    expect(boltForks(2, trunk, 4, 500)).toEqual(boltForks(2, trunk, 4, 500))
  })

  it('leaves each fork from a bend of the trunk, never its ends', () => {
    for (const fork of boltForks(2, trunk, 5, 500)) {
      expect(trunk.slice(1, -1)).toContainEqual(fork[0])
    }
  })

  it('keeps falling and stays inside the box', () => {
    for (const fork of boltForks(6, trunk, 5, 500)) {
      expect(fork.length).toBeGreaterThanOrEqual(4)
      fork.forEach((point, index) => {
        expect(point.y).toBeLessThanOrEqual(500)
        if (index > 0) expect(point.y).toBeGreaterThanOrEqual(fork[index - 1]?.y ?? 0)
      })
    }
  })

  it('makes no more forks than asked for', () => {
    expect(boltForks(2, trunk, 3, 500).length).toBeLessThanOrEqual(3)
  })
})

describe('rainStreaks', () => {
  it('is the same rain for the same seed', () => {
    expect(rainStreaks(5, 20, 400, 800, 10, 30)).toEqual(
      rainStreaks(5, 20, 400, 800, 10, 30),
    )
  })

  it('keeps every streak on the sheet and inside its lengths', () => {
    for (const streak of rainStreaks(9, 60, 400, 800, 10, 30)) {
      expect(streak.y).toBeGreaterThanOrEqual(0)
      expect(streak.y).toBeLessThan(800)
      expect(streak.length).toBeGreaterThanOrEqual(10)
      expect(streak.length).toBeLessThanOrEqual(30)
    }
  })
})

describe('splashSpots', () => {
  it('is the same splashes for the same seed', () => {
    expect(splashSpots(4, 12)).toEqual(splashSpots(4, 12))
  })

  it('spreads them along the surface in order, on beats of their own', () => {
    const spots = splashSpots(4, 12)
    expect(spots).toHaveLength(12)
    const at = spots.map((spot) => spot.at)
    expect(at).toEqual([...at].sort((a, b) => a - b))
    expect(Math.min(...at)).toBeGreaterThan(0)
    expect(Math.max(...at)).toBeLessThan(1)
    expect(new Set(spots.map((spot) => spot.offset)).size).toBe(12)
  })
})
