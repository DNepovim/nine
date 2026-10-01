import { describe, expect, it } from 'vitest'

import { UP } from '@/machines/arcade'

import {
  mouthStub,
  pitchFor,
  pointsOf,
  splineFor,
  splinePath,
  splinePoint,
  type Spline,
} from './arcade-layout'

const way = { to: '1.2', angle: UP + 0.3, reach: 1, value: 120 }
const pitch = 132

// A clock at zero leaves the sine at the way's own phase rather than at nothing, so the one
// moment a way is provably unswayed is where that sine crosses zero.
const unswayed = (s: Spline): number => (-s.phase / (Math.PI * 2)) * s.period

describe('pitchFor', () => {
  it('takes a share of the canvas', () => {
    expect(pitchFor(330)).toBeCloseTo(132)
  })
})

describe('splineFor', () => {
  it('ends where the way ends', () => {
    const s = splineFor(way, UP, pitch)
    expect(Math.hypot(s.toX, s.toY)).toBeCloseTo(pitch * way.reach)
    expect(Math.atan2(s.toY, s.toX)).toBeCloseTo(way.angle)
  })

  it('bends along a unit normal', () => {
    const s = splineFor(way, UP, pitch)
    expect(Math.hypot(s.nx, s.ny)).toBeCloseTo(1)
    expect(s.nx * s.toX + s.ny * s.toY).toBeCloseTo(0)
  })

  it('measures the curve, which is never shorter than the straight line', () => {
    const s = splineFor(way, UP + 0.6, pitch)
    const chord = Math.hypot(s.toX, s.toY)
    expect(s.length).toBeGreaterThanOrEqual(chord - 0.001)
    expect(s.length).toBeLessThan(chord * 1.5)
  })

  it('gives neighbouring ways their own breath', () => {
    const a = splineFor({ to: '0', angle: UP, reach: 1, value: 10 }, UP, pitch)
    const b = splineFor({ to: '1', angle: UP, reach: 1, value: 20 }, UP, pitch)
    expect([a.period, a.phase]).not.toEqual([b.period, b.phase])
  })
})

describe('splinePoint', () => {
  it('starts on the crossroad and ends on the bud', () => {
    const s = splineFor(way, UP, pitch)
    const at = unswayed(s)
    const start = splinePoint(s, 0, at)
    expect(start.x).toBeCloseTo(0)
    expect(start.y).toBeCloseTo(0)
    const end = splinePoint(s, 1, at)
    expect(end.x).toBeCloseTo(s.toX)
    expect(end.y).toBeCloseTo(s.toY)
  })

  it('climbs the whole way there', () => {
    const s = splineFor(way, UP, pitch)
    const at = unswayed(s)
    let last = 0
    for (let i = 1; i <= 10; i++) {
      const y = splinePoint(s, i / 10, at).y
      expect(y).toBeLessThan(last)
      last = y
    }
  })

  it('moves as the way breathes', () => {
    const s = splineFor(way, UP, pitch)
    const still = splinePoint(s, 0.5, unswayed(s))
    const later = splinePoint(s, 0.5, unswayed(s) + s.period / 4)
    expect(Math.hypot(later.x - still.x, later.y - still.y)).toBeGreaterThan(1)
  })
})

describe('splinePath', () => {
  it('draws from the crossroad in the box to the way’s end', () => {
    const s = splineFor(way, UP, pitch)
    const d = splinePath(s, unswayed(s), 200, 200)
    expect(d.startsWith('M200 200 C')).toBe(true)
    expect(d.endsWith(`${200 + s.toX} ${200 + s.toY}`)).toBe(true)
  })
})

describe('mouthStub', () => {
  it('hangs straight down, and shorter than a way', () => {
    const s = mouthStub(pitch)
    expect(s.toX).toBeCloseTo(0)
    expect(s.toY).toBeGreaterThan(0)
    expect(s.toY).toBeLessThan(pitch)
  })
})

describe('pointsOf', () => {
  it('turns pitches into points', () => {
    expect(pointsOf({ x: 1, y: -2.5 }, 100)).toEqual({ x: 100, y: -250 })
  })
})
