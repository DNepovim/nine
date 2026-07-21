import { describe, expect, it } from 'vitest'

import {
  DIFFICULTIES,
  DIFFICULTY_COLORS,
  DIFFICULTY_ORDER,
  effectiveTimeout,
  MODE_COLORS,
  MODE_DESCRIPTIONS,
  MODE_ORDER,
  MODES,
  streakMultiplier,
} from '@/machines/modes'

describe('effectiveTimeout', () => {
  it('scales the mode base timeout by the difficulty scale', () => {
    expect(effectiveTimeout('speed', 'extreme')).toBe(4400) // 8000 * 0.55
    expect(effectiveTimeout('accuracy', 'easy')).toBe(28600) // 22000 * 1.30
    expect(effectiveTimeout('accuracy', 'medium')).toBe(22000)
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
    expect(DIFFICULTY_ORDER).toEqual(['easy', 'medium', 'hard', 'extreme'])
    expect(MODES.trainee.lives).toBe(Number.POSITIVE_INFINITY)
    expect(MODES.speed.streak).toBe('clear')
    expect(MODES.accuracy.streak).toBe('optimal')
    expect(DIFFICULTIES.extreme.maxTargets).toBe(4)
  })
})

describe('colors and descriptions', () => {
  it('has a color + description per mode and a color per difficulty', () => {
    expect(Object.keys(MODE_COLORS)).toEqual(['trainee', 'accuracy', 'speed'])
    expect(MODE_DESCRIPTIONS.speed.length).toBeGreaterThan(0)
    expect(DIFFICULTY_COLORS.extreme).toBe('#E5534B')
  })
})
