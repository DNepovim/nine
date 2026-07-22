import { describe, expect, it } from 'vitest'

import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  effectiveTimeout,
  getDifficultyColor,
  lerpColor,
  MODE_DESCRIPTIONS,
  MODE_GRADIENT,
  MODE_ORDER,
  MODES,
  streakMultiplier,
} from '@/machines/modes'

describe('effectiveTimeout', () => {
  it('scales the mode base timeout by the difficulty scale', () => {
    expect(effectiveTimeout('speed', 'extreme')).toBe(4400) // 8000 * 0.55
    expect(effectiveTimeout('accuracy', 'easy')).toBe(28600) // 22000 * 1.30
    expect(effectiveTimeout('accuracy', 'hard')).toBe(16500)
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
    expect(MODES.speed.streak).toBe('clear')
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
