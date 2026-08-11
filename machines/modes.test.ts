import { describe, expect, it } from 'vitest'

import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  effectiveSpawnInterval,
  effectiveTimeout,
  getDifficultyColor,
  lerpColor,
  MODE_DESCRIPTIONS,
  MODE_GRADIENT,
  MODE_ORDER,
  MODES,
  rampedTimeout,
  streakMultiplier,
} from '@/machines/modes'

describe('effectiveTimeout', () => {
  it('scales the mode base timeout by the difficulty scale', () => {
    expect(effectiveTimeout('speed', 'extreme')).toBe(8067) // 14667 * 0.55
    expect(effectiveTimeout('accuracy', 'easy')).toBe(28600) // 22000 * 1.30
    expect(effectiveTimeout('accuracy', 'hard')).toBe(16500)
  })

  it('keeps Speed one and a half times faster than Accuracy at every difficulty', () => {
    for (const difficulty of ['easy', 'hard', 'extreme'] as const) {
      const ratio =
        effectiveTimeout('accuracy', difficulty) / effectiveTimeout('speed', difficulty)
      expect(ratio).toBeCloseTo(1.5, 2)
    }
  })
})

describe('rampedTimeout', () => {
  const base = effectiveTimeout('speed', 'hard')

  it('starts a run at the mode timeout', () => {
    expect(rampedTimeout('speed', 'hard', 0)).toBe(base)
  })

  it('closes half the slack every twenty hits', () => {
    // floor is 65% of base, so 35% of base is up for grabs.
    const floor = base * 0.65
    expect(rampedTimeout('speed', 'hard', 20)).toBe(
      Math.round(floor + (base - floor) / 2),
    )
    expect(rampedTimeout('speed', 'hard', 40)).toBe(
      Math.round(floor + (base - floor) / 4),
    )
  })

  it('contracts by less and less — the rate itself decays', () => {
    const at = (hits: number) => rampedTimeout('speed', 'hard', hits)
    const first = at(0) - at(20)
    const second = at(20) - at(40)
    const third = at(40) - at(60)
    expect(second).toBeLessThan(first)
    expect(third).toBeLessThan(second)
    // Each window gives up roughly half of what the one before it did.
    expect(second / first).toBeCloseTo(0.5, 1)
  })

  it('never falls below the floor, however long the run', () => {
    // The curve approaches the floor from above and never crosses it, though
    // rounding lands it exactly on the floor once the gap is sub-millisecond.
    const floor = Math.round(base * 0.65)
    expect(rampedTimeout('speed', 'hard', 500)).toBe(floor)
    expect(rampedTimeout('speed', 'hard', 5000)).toBe(floor)
    expect(rampedTimeout('speed', 'hard', 200)).toBeGreaterThanOrEqual(floor)
  })

  it('decreases monotonically', () => {
    let prev = Number.POSITIVE_INFINITY
    for (let hits = 0; hits <= 100; hits += 5) {
      const next = rampedTimeout('speed', 'hard', hits)
      expect(next).toBeLessThanOrEqual(prev)
      prev = next
    }
  })

  it('leaves the non-ramping modes flat', () => {
    for (const mode of ['trainee', 'accuracy'] as const) {
      const flat = effectiveTimeout(mode, 'hard')
      expect(rampedTimeout(mode, 'hard', 0)).toBe(flat)
      expect(rampedTimeout(mode, 'hard', 200)).toBe(flat)
    }
  })

  it('treats a negative hit count as the start of a run', () => {
    expect(rampedTimeout('speed', 'hard', -5)).toBe(base)
  })
})

describe('effectiveSpawnInterval', () => {
  it('is a third of the clock a target would get right now', () => {
    for (const hits of [0, 20, 60]) {
      expect(effectiveSpawnInterval('speed', 'hard', hits)).toBe(
        Math.round(rampedTimeout('speed', 'hard', hits) / 3),
      )
    }
  })

  it('tightens with the ramp, so the board keeps its density', () => {
    const start = effectiveSpawnInterval('speed', 'hard', 0)
    const later = effectiveSpawnInterval('speed', 'hard', 60)
    expect(later).toBeLessThan(start)
    // Lifetime over cadence is what sets how many targets share the board; holding
    // it at 3 is the point of ramping the cadence alongside the clock.
    expect(rampedTimeout('speed', 'hard', 60) / later).toBeCloseTo(3, 1)
  })

  it('stays flat in the non-ramping modes', () => {
    expect(effectiveSpawnInterval('accuracy', 'hard', 0)).toBe(
      effectiveSpawnInterval('accuracy', 'hard', 200),
    )
  })
})

describe('streakMultiplier', () => {
  it('doubles per trigger and caps at 8', () => {
    expect(streakMultiplier(0)).toBe(1)
    expect(streakMultiplier(1)).toBe(2)
    expect(streakMultiplier(2)).toBe(4)
    expect(streakMultiplier(3)).toBe(8)
    expect(streakMultiplier(4)).toBe(8)
    expect(streakMultiplier(10)).toBe(8)
  })
})

describe('config tables', () => {
  it('orders and keys line up', () => {
    expect(MODE_ORDER).toEqual(['trainee', 'accuracy', 'speed'])
    expect(DIFFICULTY_ORDER).toEqual(['easy', 'hard', 'extreme'])
    expect(MODES.trainee.lives).toBe(Number.POSITIVE_INFINITY)
    expect(MODES.speed.streak).toBe('fast')
    expect(MODES.accuracy.streak).toBe('optimal')
    expect(DIFFICULTIES.extreme.maxTargets).toBe(4)
  })
})

describe('colors and descriptions', () => {
  it('mode gradient stops chain correctly (end of N = start of N+1)', () => {
    expect(MODE_GRADIENT.trainee[1]).toBe(MODE_GRADIENT.accuracy[0])
    expect(MODE_GRADIENT.accuracy[1]).toBe(MODE_GRADIENT.speed[0])
    expect(MODE_DESCRIPTIONS.speed.length).toBeGreaterThan(0)
  })

  it('getDifficultyColor returns gradient endpoints for easy/extreme and hex for others', () => {
    expect(getDifficultyColor('speed', 'easy')).toBe(MODE_GRADIENT.speed[0])
    expect(getDifficultyColor('speed', 'extreme')).toBe(MODE_GRADIENT.speed[1])
    expect(getDifficultyColor('accuracy', 'hard')).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('lerpColor interpolates linearly between two hex colors', () => {
    expect(lerpColor('#000000', '#ffffff', 0)).toBe('#000000')
    expect(lerpColor('#000000', '#ffffff', 1)).toBe('#ffffff')
    expect(lerpColor('#000000', '#ffffff', 0.5)).toBe('#808080')
  })
})
