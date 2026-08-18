import { describe, expect, it } from 'vitest'

import type { Grid } from '@/machines/game'
import {
  cellWeight,
  cleanHitReason,
  computeHitPoints,
  computePar,
  computeRoute,
  FAST_BAND,
  isCleanHit,
  movePlan,
  speedReward,
  stepCost,
} from '@/machines/scoring'

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

// What Trainee celebrates: the hit rather than the run, and the route rather than
// the clock.
describe('isCleanHit', () => {
  it('celebrates a hit taken in optimal steps however slow', () => {
    expect(isCleanHit({ accFactor: 1, spdFactor: 0 })).toBe(true)
  })

  it('stays quiet for a fast hit that wasted moves', () => {
    // Speed alone earns nothing here. Trainee is about the route, and cheering a
    // quick sloppy hit taught the opposite of what the mode is for.
    expect(isCleanHit({ accFactor: 0, spdFactor: 0.9 })).toBe(false)
    expect(isCleanHit({ accFactor: 0.8, spdFactor: 1 })).toBe(false)
  })

  it('stays quiet for a hit that is neither', () => {
    expect(isCleanHit({ accFactor: 0.8, spdFactor: 0.59 })).toBe(false)
  })

  it('wants exactly optimal steps, not nearly', () => {
    expect(isCleanHit({ accFactor: 0.99, spdFactor: 0 })).toBe(false)
  })
})

// Which of the two things a batch is being congratulated for. Speed is never a
// reason on its own; it only sharpens the accuracy one.
describe('cleanHitReason', () => {
  it('is null when nothing in the batch was clean', () => {
    expect(cleanHitReason([{ accFactor: 0.8, spdFactor: 0.2 }])).toBeNull()
  })

  it('is null for an empty batch', () => {
    expect(cleanHitReason([])).toBeNull()
  })

  it('is null for a fast but wasteful hit, which the coach debriefs instead', () => {
    expect(cleanHitReason([{ accFactor: 0.5, spdFactor: 0.8 }])).toBeNull()
  })

  it('names accuracy for an optimal but unhurried hit', () => {
    expect(cleanHitReason([{ accFactor: 1, spdFactor: 0.2 }])).toBe('accuracy')
  })

  it('names both when one hit managed both', () => {
    expect(cleanHitReason([{ accFactor: 1, spdFactor: 0.8 }])).toBe('both')
  })

  it('names both when the batch earned one each', () => {
    expect(
      cleanHitReason([
        { accFactor: 1, spdFactor: 0.1 },
        { accFactor: 0.4, spdFactor: 0.9 },
      ]),
    ).toBe('both')
  })

  it('treats the speed threshold as inclusive when accuracy already qualified', () => {
    expect(cleanHitReason([{ accFactor: 1, spdFactor: 0.6 }])).toBe('both')
  })
})

describe('computePar (unchanged)', () => {
  it('returns 0 steps for a target of 0 on an empty grid', () => {
    expect(computePar(empty as unknown as Parameters<typeof computePar>[0], 0)).toBe(0)
  })
})

describe('cellWeight', () => {
  it('multiplies one-based row by one-based column', () => {
    expect(cellWeight(0)).toBe(1)
    expect(cellWeight(4)).toBe(4)
    expect(cellWeight(8)).toBe(9)
  })

  it('returns 0 outside the grid', () => {
    expect(cellWeight(9)).toBe(0)
  })
})

describe('computeRoute', () => {
  const empty: Grid = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]

  it('is empty when the grid already sums to the target', () => {
    expect(computeRoute(empty, 0)).toEqual([])
  })

  it('costs exactly what computePar says, for every route it finds', () => {
    // The two must agree or the hint would contradict the debrief above it.
    for (const target of [7, 31, 100, 123, 223, 324]) {
      const route = computeRoute(empty, target)
      const spent = route.reduce((sum, step) => sum + step.steps, 0)
      expect(spent).toBe(computePar(empty, target))
    }
  })

  it('names only weights the dial actually has, and never an empty instruction', () => {
    const route = computeRoute(empty, 223)
    expect(route.length).toBeGreaterThan(0)
    const dialWeights = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8].map(cellWeight))
    for (const step of route) {
      expect(dialWeights.has(step.weight)).toBe(true)
      expect(step.steps).toBeGreaterThan(0)
    }
  })

  it('never lists one weight twice for the same walk', () => {
    // Walks of the same weight and direction combine; a weight can still appear twice
    // when the gestures differ, because those are two things to do rather than one
    // said twice.
    for (const target of [7, 31, 100, 123, 223, 324]) {
      const walks = computeRoute(empty, target)
        .filter((step) => step.jump === null)
        .map((step) => `${step.weight}:${step.direction}`)
      expect(new Set(walks).size).toBe(walks.length)
    }
  })

  it('prices every move plan exactly as stepCost does', () => {
    // Two independent implementations of the same four routes. The hint and the par it
    // sits under must never disagree about what a key costs.
    for (let from = 0; from <= 9; from++) {
      for (let to = 0; to <= 9; to++) {
        expect(movePlan(from, to).steps).toBe(stepCost(from, to))
      }
    }
  })

  it('describes a plan that actually lands on the value', () => {
    for (let from = 0; from <= 9; from++) {
      for (let to = 0; to <= 9; to++) {
        const plan = movePlan(from, to)
        const start = plan.jump === null ? from : plan.jump === 'zero' ? 0 : 9
        const delta = plan.direction === 'up' ? plan.moves : -plan.moves
        expect((((start + delta) % 10) + 10) % 10).toBe(to)
      }
    }
  })

  it('walks rather than jumps when the two cost the same', () => {
    // 0 → 1 is one tap, and resetting to 0 first would also be one step plus a tap.
    expect(movePlan(0, 1)).toMatchObject({ jump: null, direction: 'up', moves: 1 })
  })

  it('walks down when down is shorter', () => {
    expect(movePlan(5, 4)).toMatchObject({ jump: null, direction: 'down', moves: 1 })
  })

  it('wraps upward rather than walking the long way', () => {
    expect(movePlan(9, 0)).toMatchObject({ jump: null, direction: 'up', moves: 1 })
  })

  it('jumps to an end when walking there would take longer', () => {
    // 4 → 9 is five taps up or five downs; a swipe right lands in one.
    expect(movePlan(4, 9)).toMatchObject({ jump: 'nine', moves: 0 })
    expect(movePlan(5, 0)).toMatchObject({ jump: 'zero', moves: 0 })
  })

  it('adds up the two keys that share a weight instead of listing both', () => {
    // Reaching 4 costs one step on each ×2 key, or two on one of them — the same to
    // the sum either way, so it is reported once as 2× rather than twice as 1×.
    const route = computeRoute(empty, 4)
    const twos = route.filter((step) => step.weight === 2)
    expect(twos.length).toBeLessThanOrEqual(1)
    expect(route.reduce((sum, step) => sum + step.steps, 0)).toBe(computePar(empty, 4))
  })

  it('names the coarsest key first', () => {
    const route = computeRoute(empty, 223)
    const weights = route.map((step) => step.weight)
    expect([...weights].sort((a, b) => b - a)).toEqual(weights)
  })

  it('omits buttons that are already right', () => {
    const grid: Grid = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 1],
    ]
    // 9 is already on the ×9 key, so reaching 9 asks for nothing.
    expect(computeRoute(grid, 9)).toEqual([])
  })

  it('is empty for a target off the board', () => {
    expect(computeRoute(empty, -1)).toEqual([])
    expect(computeRoute(empty, 325)).toEqual([])
  })
})
