import { describe, expect, it } from 'vitest'

import { livingVitals, RESTING, vitalsOf } from '@/lib/vitals'

describe('vitalsOf', () => {
  it('reads a patient at rest before anything is hit', () => {
    expect(vitalsOf(RESTING)).toEqual({
      heartRate: 60,
      pressure: [111, 72],
      oxygen: 98,
      respiration: 12,
      temperature: 36.5,
    })
  })

  it('quickens the pulse and the pressure with speed', () => {
    const slow = vitalsOf({ ...RESTING, speed: 10, hits: 5 })
    const fast = vitalsOf({ ...RESTING, speed: 90, hits: 5 })
    expect(fast.heartRate).toBeGreaterThan(slow.heartRate)
    expect(fast.pressure[0]).toBeGreaterThan(slow.pressure[0])
  })

  it('lets oxygen follow accuracy', () => {
    const sloppy = vitalsOf({ ...RESTING, accuracy: 20, hits: 5 })
    const clean = vitalsOf({ ...RESTING, accuracy: 100, hits: 5 })
    expect(clean.oxygen).toBeGreaterThan(sloppy.oxygen)
    expect(clean.oxygen).toBe(99)
  })

  it('keeps every figure inside what a monitor would show', () => {
    const wild = vitalsOf({ accuracy: 900, speed: 900, streak: 900, hits: 900, lives: 3 })
    expect(wild.heartRate).toBeLessThanOrEqual(150)
    expect(wild.oxygen).toBeLessThanOrEqual(99)
    expect(wild.respiration).toBeLessThanOrEqual(24)
    expect(wild.temperature).toBeLessThanOrEqual(38.5)
  })
})

describe('livingVitals', () => {
  const base = vitalsOf({ ...RESTING, speed: 50, accuracy: 80, hits: 10, streak: 4 })

  it('is the same on the same beat and wanders from beat to beat', () => {
    expect(livingVitals(base, 3)).toEqual(livingVitals(base, 3))
    const seen = new Set(
      Array.from({ length: 12 }, (_, beat) => livingVitals(base, beat).heartRate),
    )
    expect(seen.size).toBeGreaterThan(1)
  })

  it('stays within a few points of the figure the run gives it', () => {
    for (let beat = 0; beat < 50; beat += 1) {
      const live = livingVitals(base, beat)
      expect(Math.abs(live.heartRate - base.heartRate)).toBeLessThanOrEqual(2)
      expect(Math.abs(live.oxygen - base.oxygen)).toBeLessThanOrEqual(1)
      expect(live.oxygen).toBeLessThanOrEqual(100)
    }
  })
})
