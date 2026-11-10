import { describe, expect, it } from 'vitest'

import { WAX_POINTS, waxColor, waxHeat, waxPath, waxPoints } from '@/lib/wax'

const SHAPE = { cx: 100, cy: 100, radius: 40, time: 1.3, phase: 0.7 } as const

const distance = (p: { x: number; y: number }) => Math.hypot(p.x - 100, p.y - 100)

describe('waxPoints', () => {
  it('is a round lump, standing still, at nought life', () => {
    const early = waxPoints({ ...SHAPE, heading: 1, life: 0 })
    const later = waxPoints({ ...SHAPE, time: 9, heading: 1, life: 0 })
    expect(early).toHaveLength(WAX_POINTS)
    for (const p of early) expect(distance(p)).toBeCloseTo(40, 6)
    expect(later).toEqual(early)
  })

  it('draws a rising number with its head up and a falling one with it down', () => {
    const rising = waxPoints({ ...SHAPE, time: 0, phase: 0, heading: 1, life: 1 })
    const falling = waxPoints({ ...SHAPE, time: 0, phase: 0, heading: -1, life: 1 })
    const top = (points: ReturnType<typeof waxPoints>) =>
      Math.min(...points.map((p) => p.y))
    const foot = (points: ReturnType<typeof waxPoints>) =>
      Math.max(...points.map((p) => p.y))
    expect(100 - top(rising)).toBeGreaterThan(foot(rising) - 100)
    expect(foot(falling) - 100).toBeGreaterThan(100 - top(falling))
  })

  it('moves as its clock does, and out of step with a neighbour', () => {
    const now = waxPoints({ ...SHAPE, heading: 0, life: 1 })
    const later = waxPoints({ ...SHAPE, time: SHAPE.time + 1, heading: 0, life: 1 })
    const other = waxPoints({ ...SHAPE, phase: SHAPE.phase + 2, heading: 0, life: 1 })
    expect(later).not.toEqual(now)
    expect(other).not.toEqual(now)
  })

  it('keeps life inside nought to one', () => {
    expect(waxPoints({ ...SHAPE, heading: 1, life: 4 })).toEqual(
      waxPoints({ ...SHAPE, heading: 1, life: 1 }),
    )
    expect(waxPoints({ ...SHAPE, heading: 1, life: -2 })).toEqual(
      waxPoints({ ...SHAPE, heading: 1, life: 0 }),
    )
  })
})

describe('waxPath', () => {
  it('is one closed curve of a cubic per point', () => {
    const d = waxPath(waxPoints({ ...SHAPE, heading: 0, life: 1 }))
    expect(d.startsWith('M')).toBe(true)
    expect(d.endsWith('Z')).toBe(true)
    expect(d.match(/C/g)).toHaveLength(WAX_POINTS)
  })

  it('is empty for no points', () => {
    expect(waxPath([])).toBe('Z')
  })
})

describe('waxHeat', () => {
  it('runs from nought at nothing to one at the ceiling', () => {
    expect(waxHeat(0, 81)).toBe(0)
    expect(waxHeat(40.5, 81)).toBeCloseTo(0.5, 6)
    expect(waxHeat(81, 81)).toBe(1)
  })

  it('clamps a number past either end instead of wrapping', () => {
    expect(waxHeat(120, 81)).toBe(1)
    expect(waxHeat(-3, 81)).toBe(0)
  })

  it('is cold on a board with no ceiling', () => {
    expect(waxHeat(5, 0)).toBe(0)
  })
})

describe('waxColor', () => {
  it('is the cool end at nothing and the hot end at the ceiling', () => {
    expect(waxColor(0, 81, '#5b2a9e', '#d92d86')).toBe('#5b2a9e')
    expect(waxColor(81, 81, '#5b2a9e', '#d92d86')).toBe('#d92d86')
  })

  it('warms toward the hot end as the number rises', () => {
    const red = (hex: string) => parseInt(hex.slice(1, 3), 16)
    const low = waxColor(10, 81, '#5b2a9e', '#d92d86')
    const high = waxColor(60, 81, '#5b2a9e', '#d92d86')
    expect(red(high)).toBeGreaterThan(red(low))
  })
})
