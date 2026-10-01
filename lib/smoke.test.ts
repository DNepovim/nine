import { describe, expect, it } from 'vitest'

import {
  createTrail,
  driftTrail,
  LAY_MS,
  layTrail,
  ribbonPath,
  smokeLife,
  type Trail,
} from './smoke'

const SIZE = 15

const numbers = (d: string): number[] =>
  (d.match(/-?\d+(\.\d+)?(e-?\d+)?/g) ?? []).map((v) => Number(v))

// A trail laid along the x axis at a steady speed, one sample every `LAY_MS`.
const walked = (
  speed: number,
  steps: number,
  step = 6,
): { trail: Trail; now: number } => {
  const trail = createTrail()
  let now = 0
  for (let i = 0; i < steps; i++) {
    layTrail(trail, i * step * speed, 0, speed, now, SIZE)
    now += LAY_MS
  }
  return { trail, now }
}

// How far the ribbon reaches off the axis it was laid along.
const spread = (d: string): number => {
  const all = numbers(d)
  let most = 0
  for (let i = 1; i < all.length; i += 2) most = Math.max(most, Math.abs(all[i] ?? 0))
  return most
}

describe('smokeLife', () => {
  it('lets smoke laid under way last longer than smoke laid at a halt', () => {
    expect(smokeLife(1)).toBeGreaterThan(smokeLife(0) * 2)
  })

  it('is gone inside half a second at a halt', () => {
    expect(smokeLife(0)).toBeLessThan(500)
  })

  it('holds speeds that are out of range to the ends of the range', () => {
    expect(smokeLife(-3)).toBe(smokeLife(0))
    expect(smokeLife(9)).toBe(smokeLife(1))
  })
})

describe('ribbonPath', () => {
  it('draws nothing from a trail nothing has been laid in', () => {
    expect(ribbonPath(createTrail(), 0, SIZE, 0, 0)).toBe('')
  })

  it('draws nothing from a trail too short to have a shape', () => {
    const trail = createTrail()
    layTrail(trail, 0, 0, 1, 0, SIZE)
    layTrail(trail, 6, 0, 1, LAY_MS, SIZE)
    expect(ribbonPath(trail, LAY_MS * 2, SIZE, 0, 0)).toBe('')
  })

  it('is a closed shape of numbers', () => {
    const { trail, now } = walked(1, 20)
    const d = ribbonPath(trail, now, SIZE, 0, 0)
    expect(d.startsWith('M')).toBe(true)
    expect(d.trim().endsWith('Z')).toBe(true)
    for (const value of numbers(d)) expect(Number.isFinite(value)).toBe(true)
  })

  it('is drawn against the origin it is given', () => {
    const { trail, now } = walked(1, 20)
    const here = numbers(ribbonPath(trail, now, SIZE, 0, 0))
    const away = numbers(ribbonPath(trail, now, SIZE, 100, 0))
    expect(away[0]).toBeCloseTo((here[0] ?? 0) - 100, 5)
  })

  it('widens as it ages', () => {
    const { trail, now } = walked(1, 20)
    const fresh = spread(ribbonPath(trail, now, SIZE, 0, 0))
    const older = spread(ribbonPath(trail, now + 300, SIZE, 0, 0))
    expect(older).toBeGreaterThan(fresh)
  })

  it('stays a small piece at a halt and opens out under way', () => {
    const still = walked(0, 20)
    const going = walked(1, 20)
    const atHalt = spread(ribbonPath(still.trail, still.now, SIZE, 0, 0))
    const underWay = spread(ribbonPath(going.trail, going.now, SIZE, 0, 0))
    expect(atHalt).toBeGreaterThan(0)
    expect(atHalt).toBeLessThan(SIZE)
    expect(underWay).toBeGreaterThan(atHalt * 1.5)
  })

  it('ends at the first sample too old to show', () => {
    const { trail, now } = walked(1, 30)
    const whole = numbers(ribbonPath(trail, now, SIZE, 0, 0)).length
    const docked = numbers(ribbonPath(trail, now + smokeLife(1) * 0.7, SIZE, 0, 0)).length
    expect(docked).toBeGreaterThan(0)
    expect(docked).toBeLessThan(whole)
  })

  it('is gone once the last sample has outlived itself', () => {
    const { trail, now } = walked(1, 20)
    expect(ribbonPath(trail, now + smokeLife(1) + 1, SIZE, 0, 0)).toBe('')
  })

  it('scales with the flame it comes off', () => {
    const { trail, now } = walked(1, 20)
    const small = spread(ribbonPath(trail, now, 10, 0, 0))
    const big = spread(ribbonPath(trail, now, 20, 0, 0))
    expect(big).toBeGreaterThan(small * 1.8)
  })

  it('never looks past the ring it is written in', () => {
    // Twice round the buffer. The oldest sample must not come back as the newest.
    const { trail, now } = walked(1, 200)
    const d = ribbonPath(trail, now, SIZE, 0, 0)
    for (const value of numbers(d)) expect(Number.isFinite(value)).toBe(true)
    const xs = numbers(d).filter((_, i) => i % 2 === 0)
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(200 * 6)
  })
})

describe('driftTrail', () => {
  it('moves what has been laid and leaves empty slots alone', () => {
    const trail = createTrail()
    layTrail(trail, 0, 0, 1, 0, SIZE)
    driftTrail(trail, 16, 120, SIZE)
    expect(Math.hypot(trail.driftX[0] ?? 0, trail.driftY[0] ?? 0)).toBeGreaterThan(0)
    expect(trail.driftX[5]).toBe(0)
    expect(trail.driftY[5]).toBe(0)
  })

  it('wanders by less than the flame is wide over a whole life', () => {
    const trail = createTrail()
    layTrail(trail, 0, 0, 1, 0, SIZE)
    for (let t = 0; t < smokeLife(1); t += 16) driftTrail(trail, 16, t, SIZE)
    expect(Math.hypot(trail.driftX[0] ?? 0, trail.driftY[0] ?? 0)).toBeLessThan(SIZE)
  })

  it('leaves a fresh sample where it was laid', () => {
    const trail = createTrail()
    layTrail(trail, 4, 9, 1, 0, SIZE)
    expect(trail.x[0]).toBe(4)
    expect(trail.y[0]).toBe(9)
    expect(trail.driftX[0]).toBe(0)
  })
})

describe('layTrail', () => {
  it('scatters what it lays at a halt and lays a clean line under way', () => {
    const still = createTrail()
    const going = createTrail()
    for (let i = 0; i < 6; i++) {
      layTrail(still, 0, 0, 0, i * LAY_MS, SIZE)
      layTrail(going, i * 6, 0, 1, i * LAY_MS, SIZE)
    }
    const apart = Math.hypot(
      (still.x[0] ?? 0) - (still.x[1] ?? 0),
      (still.y[0] ?? 0) - (still.y[1] ?? 0),
    )
    expect(apart).toBeGreaterThan(0)
    expect(going.y[3]).toBe(0)
    expect(going.x[3]).toBe(18)
  })

  it('writes over the oldest slot and never anything newer', () => {
    const trail = createTrail()
    for (let i = 0; i < 41; i++) layTrail(trail, i, 0, 1, i * LAY_MS, SIZE)
    // Slot 0 has been written twice: once by the first sample, once by the forty-first.
    expect(trail.x[0]).toBe(40)
    expect(trail.head).toBe(0)
  })
})
