import { describe, expect, it } from 'vitest'

import { everyKeyMoved, STREAK_BROKEN, STREAK_TRIGGERED, type StreakFacts } from '@/modes'

// A batch that did nothing. Each test names only the facts it is about.
const facts = (over: Partial<StreakFacts> = {}): StreakFacts => ({
  anyHit: false,
  allOptimal: false,
  allFast: false,
  allWhole: false,
  clearedBoard: false,
  ...over,
})

describe('everyKeyMoved', () => {
  it('is true only when every cell stands somewhere new', () => {
    expect(everyKeyMoved([0, 0, 0, 0], [1, 2, 3, 4])).toBe(true)
    expect(everyKeyMoved([1, 2, 3, 4], [2, 3, 4, 5])).toBe(true)
  })

  it('is false when any one key stayed put', () => {
    expect(everyKeyMoved([0, 0, 0, 0], [1, 2, 3, 0])).toBe(false)
    expect(everyKeyMoved([0, 0, 0, 0], [0, 0, 0, 0])).toBe(false)
  })

  it('reads a key wound back to where it started as untouched', () => {
    // Net change, not presses — the grid is the whole of what a route leaves behind.
    // Right for a rule asking the player to use the dial rather than fidget with it.
    expect(everyKeyMoved([3, 1, 1, 1], [3, 2, 2, 2])).toBe(false)
  })

  it('refuses to compare grids of different dials', () => {
    expect(everyKeyMoved([0, 0, 0, 0], [1, 2, 3, 4, 5])).toBe(false)
  })
})

describe('the whole-dial streak', () => {
  it('builds on a hit that moved every key', () => {
    expect(STREAK_TRIGGERED.whole(facts({ anyHit: true, allWhole: true }))).toBe(true)
  })

  it('does not build on a hit that left a key alone', () => {
    expect(STREAK_TRIGGERED.whole(facts({ anyHit: true }))).toBe(false)
  })

  it('does not build on a batch with no hit in it', () => {
    // `allWhole` opens true for an empty batch the way `allOptimal` does, so the
    // `anyHit` half is what stops a frame with nothing in it extending the chain.
    expect(STREAK_TRIGGERED.whole(facts({ allWhole: true }))).toBe(false)
  })

  it('is broken by a hit that did not, which is what makes it a chain', () => {
    expect(STREAK_BROKEN.whole(facts({ anyHit: true }))).toBe(true)
    expect(STREAK_BROKEN.whole(facts())).toBe(false)
  })

  it('is a chain, unlike the rule it replaced', () => {
    // `clear` cannot be broken by anything a player does — its signature takes no facts
    // at all, so the type says it before the value does. That is the difference between
    // the two, and the reason the challenge changed rule.
    expect(STREAK_BROKEN.clear()).toBe(false)
    expect(STREAK_BROKEN.whole(facts({ anyHit: true }))).toBe(true)
  })
})
