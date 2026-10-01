import { describe, expect, it } from 'vitest'

import { REGION_SPAN, REGIONS, type RegionKey } from '@/machines/arcade-regions'

import { cellKey, featureIn, featuresIn, type LandFeature } from './arcade-land'

const nothing = () => false
const everything = () => true

// Every element of a feature, as circles, which is what the keep-out test sees.
const marks = (f: LandFeature): { x: number; y: number; r: number }[] => [
  ...f.peaks.map((p) => ({ x: p.x, y: p.y, r: p.width })),
  ...f.bumps.map((b) => ({ x: b.x, y: b.y, r: b.width })),
  ...f.trees.map((t) => ({ x: t.x, y: t.y, r: t.radius })),
]

const sweep = (region: RegionKey, cells: number): LandFeature[] => {
  const found: LandFeature[] = []
  for (let gy = -cells; gy < cells; gy++) {
    for (let gx = -cells; gx < cells; gx++) {
      const f = featureIn(region, gx, gy, 4242, nothing)
      if (f !== null) found.push(f)
    }
  }
  return found
}

describe('cellKey', () => {
  it('tells the same two coordinates in two regions apart', () => {
    expect(cellKey('forest', 2, -3)).not.toBe(cellKey('mountains', 2, -3))
  })
})

describe('featureIn', () => {
  it('gives a cell the same answer however often it is asked', () => {
    const once = featureIn('hills', 3, -5, 99, nothing)
    const twice = featureIn('hills', 3, -5, 99, nothing)
    expect(twice).toEqual(once)
  })

  it('gives a different cell a different answer', () => {
    const here = featureIn('hills', 3, -5, 99, nothing)
    const next = featureIn('hills', 4, -5, 99, nothing)
    expect(next).not.toEqual(here)
  })

  it('is a different country under a different seed', () => {
    const one = sweep('hills', 4).length
    let other = 0
    for (let gy = -4; gy < 4; gy++) {
      for (let gx = -4; gx < 4; gx++) {
        if (featureIn('hills', gx, gy, 777, nothing) !== null) other++
      }
    }
    expect(other).not.toBe(one)
  })

  it('places nothing at all where everything is blocked', () => {
    for (let gy = -3; gy < 3; gy++) {
      for (let gx = -3; gx < 3; gx++) {
        expect(featureIn('mountains', gx, gy, 5, everything)).toBeNull()
      }
    }
  })

  it('keeps every element clear of what the caller blocked', () => {
    // A way straight up the middle: nothing may be drawn within its zone of it.
    const ZONE = 0.212
    const blocked = (x: number, y: number, r: number) => Math.abs(x - 1) < ZONE + r
    for (const region of ['farmland', 'forest', 'hills', 'mountains'] as const) {
      for (let gy = -6; gy < 6; gy++) {
        for (let gx = -6; gx < 6; gx++) {
          const f = featureIn(region, gx, gy, 31, blocked)
          if (f === null) continue
          for (const m of marks(f)) {
            expect(Math.abs(m.x - 1)).toBeGreaterThanOrEqual(ZONE + m.r)
          }
        }
      }
    }
  })

  it('draws a feature back to front, so the nearer mark is drawn last', () => {
    for (const f of sweep('mountains', 6)) {
      const ys = marks(f).map((m) => m.y)
      expect([...ys].sort((a, b) => a - b)).toEqual(ys)
      expect(f.at).toBeCloseTo(Math.max(...ys))
    }
  })

  it('gives one range one kind of mountain and one lit flank', () => {
    for (const f of sweep('mountains', 6)) {
      if (f.kind !== 'ridge') continue
      expect(new Set(f.peaks.map((p) => p.form)).size).toBe(1)
      expect(new Set(f.peaks.map((p) => p.flip)).size).toBe(1)
    }
  })

  it('gives one wood one kind of tree', () => {
    for (const f of sweep('forest', 8)) {
      if (f.kind !== 'wood') continue
      expect(new Set(f.trees.map((t) => t.form)).size).toBe(1)
    }
  })

  it('fills the forest and leaves farmland room', () => {
    // Per *area*, not per cell: the lattices differ, so twenty cells of farmland cover
    // nearly four times the ground twenty cells of forest do.
    const density = (region: RegionKey): number => {
      const all = sweep(region, 10)
      const trees = all.reduce((n, f) => n + f.trees.length, 0)
      return trees / (20 * 20 * REGIONS[region].cell ** 2)
    }
    expect(density('forest')).toBeGreaterThan(density('farmland') * 4)
    expect(sweep('forest', 10).length / (20 * 20)).toBeGreaterThan(0.85)
    expect(sweep('farmland', 10).length / (20 * 20)).toBeLessThan(0.55)
  })

  it('makes the mountains mountains', () => {
    const all = sweep('mountains', 8)
    const ranges = all.filter((f) => f.kind === 'ridge')
    expect(ranges.length / all.length).toBeGreaterThan(0.7)
    expect(all.some((f) => f.kind === 'wood')).toBe(false)
  })
})

describe('featuresIn', () => {
  it('walks every region a window straddles, on each one’s own lattice', () => {
    const asked: RegionKey[] = []
    featuresIn({ left: 0, right: 1, top: -REGION_SPAN * 4, bottom: 0 }, (region) => {
      if (!asked.includes(region)) asked.push(region)
      return null
    })
    expect(asked).toEqual(['mountains', 'hills', 'forest', 'farmland'])
  })

  it('hands them back back to front', () => {
    const found = featuresIn(
      { left: -1, right: 1, top: -1, bottom: 1 },
      (region, gx, gy) => featureIn(region, gx, gy, 7, nothing),
    )
    const order = found.map((f) => f.at)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('asks for a cell once per cell, so the cache is what decides the cost', () => {
    const seen = new Set<string>()
    let asks = 0
    featuresIn({ left: 0, right: 2, top: -2, bottom: 0 }, (region, gx, gy) => {
      asks++
      seen.add(cellKey(region, gx, gy))
      return null
    })
    expect(asks).toBe(seen.size)
  })

  it('covers the window it was given', () => {
    const found = featuresIn(
      { left: 0, right: 3, top: -3, bottom: 0 },
      (region, gx, gy) => featureIn(region, gx, gy, 11, nothing),
    )
    const cell = REGIONS.farmland.cell
    expect(found.length).toBeGreaterThan(5)
    expect(cell).toBeGreaterThan(0)
  })
})
