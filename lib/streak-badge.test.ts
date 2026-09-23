import { describe, expect, it } from 'vitest'

import { SPECTRUM } from '@/constants/colors'
import { streakMultiplier } from '@/machines/modes'

import { multiplierColor } from './streak-badge'

describe('multiplierColor', () => {
  it('climbs the game scale as the streak doubles', () => {
    expect(multiplierColor(2)).toBe(SPECTRUM[0])
    expect(multiplierColor(4)).toBe(SPECTRUM[1])
    expect(multiplierColor(8)).toBe(SPECTRUM[3])
  })

  it('gives every multiplier the streak can actually reach a colour', () => {
    // The badge is drawn from whatever `streakMultiplier` produced, so the ladder has to
    // answer for the whole of its range and not just the three rungs above.
    for (let streak = 0; streak <= 6; streak += 1) {
      expect(multiplierColor(streakMultiplier(streak))).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })

  it('holds the capped colour past the top of the ladder', () => {
    // ×8 is the ceiling today. A higher one must not fall back to the opening blue.
    expect(multiplierColor(16)).toBe(SPECTRUM[3])
  })
})
