import { describe, expect, it } from 'vitest'

import { crackRays, shatterShards } from './mirror-break'

const area = (corners: readonly { x: number; y: number }[]): number =>
  Math.abs(
    corners.reduce((sum, point, index) => {
      const next = corners[(index + 1) % corners.length] ?? point
      return sum + point.x * next.y - next.x * point.y
    }, 0),
  ) / 2

describe('crackRays', () => {
  const rays = crackRays({ x: 100, y: 200 }, 150, 7)

  it('is the same crack every time for one seed, and another for another', () => {
    expect(crackRays({ x: 100, y: 200 }, 150, 7)).toEqual(rays)
    expect(crackRays({ x: 100, y: 200 }, 150, 8)).not.toEqual(rays)
  })

  it('starts its rays at the point struck, each with a length to draw it by', () => {
    expect(rays.filter((ray) => ray.path.startsWith('M 100.0 200.0'))).toHaveLength(9)
    for (const ray of rays) expect(ray.length).toBeGreaterThan(0)
  })
})

describe('shatterShards', () => {
  const shards = shatterShards(5, 7, { x: 0.5, y: 0.45 }, 3)

  it('covers the whole glass, with no gap and no overlap', () => {
    expect(shards).toHaveLength(35)
    const total = shards.reduce((sum, shard) => sum + area(shard.corners), 0)
    expect(total).toBeCloseTo(1)
  })

  it('stays on the glass', () => {
    for (const { corners } of shards) {
      for (const { x, y } of corners) {
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThanOrEqual(1)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(y).toBeLessThanOrEqual(1)
      }
    }
  })

  it('measures each piece from the impact, nought to one', () => {
    for (const { distance } of shards) {
      expect(distance).toBeGreaterThanOrEqual(0)
      expect(distance).toBeLessThanOrEqual(1)
    }
  })
})
