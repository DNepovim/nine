import { describe, expect, it } from 'vitest'

import { tonguePath } from './flame'

const numbers = (d: string): number[] =>
  (d.match(/-?\d+(\.\d+)?(e-?\d+)?/g) ?? []).map((v) => Number(v))

// The points of a path, as pairs.
const points = (d: string): { x: number; y: number }[] => {
  const all = numbers(d)
  const out: { x: number; y: number }[] = []
  for (let i = 0; i + 1 < all.length; i += 2) {
    out.push({ x: all[i] ?? 0, y: all[i + 1] ?? 0 })
  }
  return out
}

// How far the shape reaches along the tail, and across it.
const reach = (d: string, tail: number): { along: number; across: number } => {
  let along = -Infinity
  let across = 0
  for (const p of points(d)) {
    along = Math.max(along, p.x * Math.cos(tail) + p.y * Math.sin(tail))
    across = Math.max(across, Math.abs(p.x * -Math.sin(tail) + p.y * Math.cos(tail)))
  }
  return { along, across }
}

describe('tonguePath', () => {
  it('is a closed shape around where it stands', () => {
    const d = tonguePath(16, 0, 0, 0, 1, 1)
    expect(d.startsWith('M')).toBe(true)
    expect(d.trim().endsWith('Z')).toBe(true)
  })

  it('is a disc when it is standing still', () => {
    for (const p of points(tonguePath(16, 0, 0, 0, 1, 0))) {
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(16, 0)
    }
  })

  it('stays exactly as wide when it is drawn out', () => {
    // The whole point of the shape: length is a translation of the back half, not a
    // scale of the radius, so nothing reaches further sideways than it did at rest.
    for (const tail of [0, 1.1, -2.4, Math.PI]) {
      const still = reach(tonguePath(16, tail, 0, 0, 1, 0), tail)
      const drawn = reach(tonguePath(16, tail, 40, 0, 1, 0), tail)
      // Never wider, and never more than a sampling step narrower.
      expect(drawn.across).toBeLessThanOrEqual(still.across + 0.001)
      expect(drawn.across / still.across).toBeGreaterThan(0.95)
    }
  })

  it('reaches further back the longer it is drawn', () => {
    const tail = 0.8
    const still = reach(tonguePath(16, tail, 0, 0, 1, 0), tail)
    const drawn = reach(tonguePath(16, tail, 40, 0, 1, 0), tail)
    expect(drawn.along - still.along).toBeGreaterThan(30)
    expect(drawn.along - still.along).toBeLessThanOrEqual(40)
  })

  it('reaches back the way it is told to and not the other way', () => {
    const d = tonguePath(16, 0, 40, 0, 1, 0)
    const xs = points(d).map((p) => p.x)
    expect(Math.max(...xs)).toBeGreaterThan(40)
    // The leading edge only flattens a little; it never moves backwards.
    expect(Math.min(...xs)).toBeGreaterThan(-16)
    expect(Math.min(...xs)).toBeLessThan(-13)
  })

  it('narrows at the trailing end as it is drawn out', () => {
    const tail = 0
    const still = points(tonguePath(16, tail, 0, 0, 1, 0))
    const drawn = points(tonguePath(16, tail, 40, 0, 1, 0))
    // The tip sits on the axis and is drawn twice, closing the path. What says whether the
    // tongue tapers or ends blunt is the first point off it.
    const tipOf = (ps: { x: number; y: number }[]): number => {
      const sorted = [...ps].sort((a, b) => b.x - a.x)
      return Math.abs(sorted[2]?.y ?? 0)
    }
    expect(tipOf(drawn)).toBeLessThan(tipOf(still))
  })

  it('grows with its radius', () => {
    const small = reach(tonguePath(10, 0, 0, 0, 1, 0), 0)
    const big = reach(tonguePath(20, 0, 0, 0, 1, 0), 0)
    expect(big.across).toBeCloseTo(small.across * 2, 0)
  })

  it('ruffles by how much it is told to, and no more', () => {
    const plain = reach(tonguePath(16, 0, 0, 0, 1, 0), 0)
    const ruffled = reach(tonguePath(16, 0, 0, 400, 1, 2), 0)
    expect(ruffled.across).not.toBeCloseTo(plain.across, 2)
    expect(Math.abs(ruffled.across - plain.across)).toBeLessThan(16 * 0.25)
  })

  it('ruffles on a finer grain the finer it is told to be', () => {
    // Counting sign changes in the radius is counting the lobes around the edge.
    const lobes = (grain: number): number => {
      const rs = points(tonguePath(16, 0, 0, 0, grain, 3)).map((p) =>
        Math.hypot(p.x, p.y),
      )
      let turns = 0
      for (let i = 2; i < rs.length; i++) {
        const a = (rs[i - 1] ?? 0) - (rs[i - 2] ?? 0)
        const b = (rs[i] ?? 0) - (rs[i - 1] ?? 0)
        if (a * b < 0) turns += 1
      }
      return turns
    }
    expect(lobes(1)).toBeGreaterThan(lobes(0.3))
  })

  it('moves as it burns', () => {
    expect(tonguePath(16, 0, 0, 0, 1, 1)).not.toBe(tonguePath(16, 0, 0, 240, 1, 1))
  })

  it('never repeats on one period, because it is three', () => {
    expect(tonguePath(16, 0, 0, 0, 1, 1)).not.toBe(
      tonguePath(16, 0, 0, 128 * Math.PI * 2, 1, 1),
    )
  })

  it('never emits a coordinate that is not a number', () => {
    for (let t = 0; t < 4000; t += 211) {
      for (const length of [0, 7, 60]) {
        for (const value of numbers(tonguePath(16, t / 500, length, t, 1.6, 1.3))) {
          expect(Number.isFinite(value)).toBe(true)
        }
      }
    }
  })

  it('survives a radius of nothing', () => {
    for (const value of numbers(tonguePath(0, 0.4, 12, 900, 1, 1))) {
      expect(Number.isFinite(value)).toBe(true)
    }
  })
})
