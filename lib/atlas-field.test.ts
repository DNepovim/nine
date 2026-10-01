import { describe, expect, it } from 'vitest'

import { elevationAt, hashAt, noiseAt, slopeAt } from './atlas-field'

describe('hashAt', () => {
  it('answers the same for the same corner', () => {
    expect(hashAt(3, -7, 42)).toBe(hashAt(3, -7, 42))
  })

  it('answers differently for the corner next door', () => {
    expect(hashAt(3, -7, 42)).not.toBe(hashAt(4, -7, 42))
    expect(hashAt(3, -7, 42)).not.toBe(hashAt(3, -7, 43))
  })

  it('stays inside [0, 1)', () => {
    for (let i = -40; i < 40; i++) {
      const v = hashAt(i, i * 3, 7)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('noiseAt', () => {
  it('lands on the lattice corner it is given', () => {
    expect(noiseAt(0, 0, 1, 5)).toBeCloseTo(hashAt(0, 0, 5), 10)
    expect(noiseAt(2, 3, 1, 5)).toBeCloseTo(hashAt(2, 3, 5), 10)
  })

  it('is continuous — a small step is a small change', () => {
    for (let i = 0; i < 50; i++) {
      const x = i * 0.37
      const a = noiseAt(x, 1.2, 1, 9)
      const b = noiseAt(x + 0.001, 1.2, 1, 9)
      expect(Math.abs(a - b)).toBeLessThan(0.02)
    }
  })
})

describe('elevationAt', () => {
  it('is the same place every time it is asked', () => {
    expect(elevationAt(1.5, -2.25, 11)).toBe(elevationAt(1.5, -2.25, 11))
  })

  it('stays inside the range its octaves add up to', () => {
    for (let i = 0; i < 400; i++) {
      const e = elevationAt(i * 0.31, -i * 0.17, 3)
      expect(e).toBeGreaterThan(0)
      expect(e).toBeLessThan(1)
    }
  })

  it('uses the whole middle of that range, so a sea level can cut it anywhere', () => {
    const all: number[] = []
    for (let x = 0; x < 30; x += 0.3)
      for (let y = 0; y < 30; y += 0.3) all.push(elevationAt(x, -y, 5))
    expect(Math.min(...all)).toBeLessThan(0.35)
    expect(Math.max(...all)).toBeGreaterThan(0.65)
  })

  it('is a different country under a different seed', () => {
    expect(elevationAt(4, -4, 1)).not.toBeCloseTo(elevationAt(4, -4, 2), 3)
  })
})

describe('slopeAt', () => {
  it('points uphill, so its opposite is where water goes', () => {
    const seed = 17
    const x = 2.4
    const y = -1.8
    const g = slopeAt(x, y, seed)
    const step = 0.05
    const uphill = elevationAt(x + g.x * step, y + g.y * step, seed)
    const downhill = elevationAt(x - g.x * step, y - g.y * step, seed)
    expect(uphill).toBeGreaterThan(downhill)
  })
})
