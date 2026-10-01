import { describe, expect, it } from 'vitest'

import {
  REGION_ORDER,
  REGION_SPAN,
  regionAt,
  regionAtPosition,
  REGIONS,
} from './arcade-regions'

describe('regionAt', () => {
  it('opens on farmland and holds each region for its span', () => {
    expect(regionAt(0)).toBe('farmland')
    expect(regionAt(REGION_SPAN - 1)).toBe('farmland')
    expect(regionAt(REGION_SPAN)).toBe('forest')
    expect(regionAt(REGION_SPAN * 2)).toBe('hills')
    expect(regionAt(REGION_SPAN * 3)).toBe('mountains')
  })

  it('crosses the world again rather than running out of country', () => {
    expect(regionAt(REGION_SPAN * REGION_ORDER.length)).toBe('farmland')
  })

  it('answers farmland for a depth below the first crossroad', () => {
    expect(regionAt(-4)).toBe('farmland')
  })

  it('crosses them in the designed order', () => {
    const crossed = Array.from({ length: REGION_ORDER.length }, (_, i) =>
      regionAt(i * REGION_SPAN),
    )
    expect(crossed).toEqual([...REGION_ORDER])
  })
})

describe('regionAtPosition', () => {
  it('reads the region off a world position, climbing', () => {
    expect(regionAtPosition(0)).toBe('farmland')
    expect(regionAtPosition(-REGION_SPAN)).toBe('forest')
    expect(regionAtPosition(-REGION_SPAN * 3)).toBe('mountains')
  })

  it('does not fall off the bottom of the map', () => {
    expect(regionAtPosition(5)).toBe('farmland')
  })
})

describe('REGIONS', () => {
  it('gives every region a lattice and a mix that adds up', () => {
    for (const key of REGION_ORDER) {
      const region = REGIONS[key]
      expect(region.cell).toBeGreaterThan(0)
      expect(region.mix.reduce((sum, [, weight]) => sum + weight, 0)).toBeGreaterThan(0)
    }
  })

  it('keeps the regions far apart rather than hedging', () => {
    const share = (key: (typeof REGION_ORDER)[number], slot: string): number => {
      const mix = REGIONS[key].mix
      const total = mix.reduce((sum, [, weight]) => sum + weight, 0)
      return (mix.find(([name]) => name === slot)?.[1] ?? 0) / total
    }
    // The forest is a forest, the mountains are mountains, and farmland is mostly room.
    expect(share('forest', 'wood')).toBeGreaterThan(0.9)
    expect(share('mountains', 'ridge')).toBeGreaterThan(0.7)
    expect(share('farmland', 'none')).toBeGreaterThan(0.4)
    expect(share('hills', 'hills')).toBeGreaterThan(0.5)
  })

  it('gives the forest the tightest lattice and farmland the loosest', () => {
    // Not a ranking of all four: the mountains have a *looser* lattice than the hills on
    // purpose, because almost every one of their cells is a whole range. What the lattice
    // controls is how much there is, not how big it is.
    const cells = REGION_ORDER.map((key) => REGIONS[key].cell)
    expect(REGIONS.forest.cell).toBe(Math.min(...cells))
    expect(REGIONS.farmland.cell).toBe(Math.max(...cells))
  })
})
