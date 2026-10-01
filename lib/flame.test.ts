import { describe, expect, it } from 'vitest'

import { flameLean, flamePath } from './flame'

const numbers = (d: string): number[] =>
  (d.match(/-?\d+(\.\d+)?(e-?\d+)?/g) ?? []).map((v) => Number(v))

describe('flameLean', () => {
  it('leans both ways', () => {
    const over = Array.from({ length: 600 }, (_, i) => flameLean(i * 13))
    expect(Math.max(...over)).toBeGreaterThan(0.4)
    expect(Math.min(...over)).toBeLessThan(-0.4)
  })

  it('never repeats on one period, because it is two', () => {
    // A single sine would give the same answer a period later. These two do not share one.
    expect(flameLean(150 * Math.PI * 2)).not.toBeCloseTo(flameLean(0), 3)
  })
})

describe('flamePath', () => {
  it('is a closed shape rising from where it stands', () => {
    const d = flamePath(16, 0, false)
    expect(d.startsWith('M')).toBe(true)
    expect(d.trim().endsWith('Z')).toBe(true)
  })

  it('never emits a coordinate that is not a number', () => {
    for (let t = 0; t < 4000; t += 37) {
      for (const inner of [false, true]) {
        for (const value of numbers(flamePath(16, t, inner))) {
          expect(Number.isFinite(value)).toBe(true)
        }
      }
    }
  })

  it('rises upward, which on a screen is negative', () => {
    const tip = numbers(flamePath(16, 0, false))
    expect(Math.min(...tip)).toBeLessThan(0)
  })

  it('keeps the tongue inside the body', () => {
    const body = numbers(flamePath(16, 500, false))
    const tongue = numbers(flamePath(16, 500, true))
    expect(Math.abs(Math.min(...tongue))).toBeLessThan(Math.abs(Math.min(...body)))
  })

  it('moves as it burns', () => {
    expect(flamePath(16, 0, false)).not.toBe(flamePath(16, 240, false))
  })

  it('grows with its size', () => {
    const small = Math.abs(Math.min(...numbers(flamePath(10, 0, false))))
    const big = Math.abs(Math.min(...numbers(flamePath(20, 0, false))))
    expect(big).toBeGreaterThan(small * 1.6)
  })
})
