import { describe, expect, it } from 'vitest'

import { runRules } from '@/modes'

// How many lives each mode gives, which is how many hearts the game screen draws.
//
// Its own file rather than a block in `rules.test.ts`: that file is being edited on
// another branch, and this is a fact about one field rather than about the resolve.
describe('how many hearts a run draws', () => {
  // The row draws `rules.lives.count` hearts. It drew three whatever the rules said,
  // which emptied a heart on the first frame of any mode that gives fewer — and an
  // emptied heart is the losing-a-life animation.
  it('a challenge gives three, like every other mode that spends them', () => {
    // It pinned two for a while, which is what exposed the row drawing a fixed three —
    // the heart it did not have was emptied on the first frame rather than left out.
    // The row is right now whatever the count is, and this is back to three.
    expect(runRules('challenge/four-keys', 'hard').lives.count).toBe(3)
  })

  it('the scored modes still give three, so nothing moved for them', () => {
    for (const mode of ['accuracy', 'speed'] as const) {
      for (const rung of ['easy', 'hard', 'extreme'] as const) {
        expect(runRules(mode, rung).lives.count, `${mode} ${rung}`).toBe(3)
      }
    }
  })

  it('trainee spends none, which the row reads as drawing none', () => {
    expect(runRules('trainee', 'hard').lives.count).toBe(Number.POSITIVE_INFINITY)
  })

  it('every finite count is a whole number the row can draw', () => {
    for (const mode of ['accuracy', 'speed', 'challenge/four-keys'] as const) {
      const { count } = runRules(mode, 'hard').lives
      expect(Number.isInteger(count), mode).toBe(true)
      expect(count, mode).toBeGreaterThan(0)
    }
  })
})
