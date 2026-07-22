import { describe, expect, it } from 'vitest'

import { computeHitPoints, computePar } from '@/machines/scoring'

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
    // acc factor = 1, spd factor = 1 → 100 * (0.15 + 0.85) = 100
    expect(spdHeavy).toBe(100)
  })
})

describe('computePar (unchanged)', () => {
  it('returns 0 steps for a target of 0 on an empty grid', () => {
    expect(computePar(empty as unknown as Parameters<typeof computePar>[0], 0)).toBe(0)
  })
})
