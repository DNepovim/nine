import { describe, expect, it } from 'vitest'

import { computeHitPoints, computePar, FAST_BAND, speedReward } from '@/machines/scoring'

const empty = [
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
] as const

describe('computeHitPoints weights', () => {
  it('weights accuracy and speed per the supplied blend', () => {
    // perfect accuracy (userSteps == par), zero speed
    const accHeavy = computeHitPoints({
      par: 2,
      userSteps: 2,
      timeLeft: 0,
      duration: 10000,
      weights: { acc: 0.85, spd: 0.15 },
    })
    // acc factor = 1, spd factor = 0 → 100 * 0.85 = 85
    expect(accHeavy).toBe(85)

    const spdHeavy = computeHitPoints({
      par: 2,
      userSteps: 2,
      timeLeft: 10000,
      duration: 10000,
      weights: { acc: 0.15, spd: 0.85 },
    })
    // acc = 1, speed reward = 1.25 at an instant hit → 100 * (0.15 + 0.85 * 1.25) = 121
    expect(spdHeavy).toBe(121)
  })

  it('pays a hit inside the fast band more than the straight line would', () => {
    const opts = {
      par: 2,
      userSteps: 2,
      duration: 10000,
      weights: { acc: 0, spd: 1 },
    }
    // At the band edge the reward is still plain time-left.
    expect(computeHitPoints({ ...opts, timeLeft: 8500 })).toBe(85)
    // Past it the curve lifts: 0.95 → 0.95 + 0.25 * (0.10 / 0.15) ≈ 1.117.
    expect(computeHitPoints({ ...opts, timeLeft: 9500 })).toBe(112)
  })
})

describe('speedReward', () => {
  it('leaves anything at or below the band untouched', () => {
    expect(speedReward(0)).toBe(0)
    expect(speedReward(0.5)).toBe(0.5)
    expect(speedReward(FAST_BAND)).toBe(FAST_BAND)
  })

  it('reaches 1.25 for an instant hit', () => {
    expect(speedReward(1)).toBeCloseTo(1.25, 5)
  })

  it('rises continuously out of the band rather than jumping', () => {
    expect(speedReward(FAST_BAND + 0.0001)).toBeCloseTo(FAST_BAND, 3)
  })

  it('widens the gap between quick and instant', () => {
    // Linearly, 1.0 beats 0.7 by 1.43x. With the curve it is nearly 1.8x.
    expect(speedReward(1) / speedReward(0.7)).toBeGreaterThan(1.7)
  })
})

describe('computePar (unchanged)', () => {
  it('returns 0 steps for a target of 0 on an empty grid', () => {
    expect(computePar(empty as unknown as Parameters<typeof computePar>[0], 0)).toBe(0)
  })
})
