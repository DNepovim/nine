import { describe, expect, it } from 'vitest'

import {
  defineDial,
  everyKeyMoved,
  everyRowMoved,
  STREAK_BROKEN,
  STREAK_TRIGGERED,
  type StreakFacts,
} from '@/modes'

// A batch that did nothing. Each test names only the facts it is about.
const facts = (over: Partial<StreakFacts> = {}): StreakFacts => ({
  anyHit: false,
  allOptimal: false,
  allFast: false,
  allWhole: false,
  allSpread: false,
  allFresh: false,
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

describe('everyRowMoved', () => {
  // The dial `spread` was written for: four rows of four.
  const dial = defineDial({ id: 'test-four-by-four', rows: 4, cols: 4 })
  const still = new Array<number>(16).fill(0)
  // The dial's diagonal: one key moved in each row, which is the least that satisfies
  // the rule.
  const oneEach = still.map((digit, index) =>
    index % 4 === Math.floor(index / 4) ? digit + 1 : digit,
  )

  it('is true when a key moved in every row, however few in total', () => {
    expect(
      everyRowMoved(dial, still, [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]),
    ).toBe(true)
    // Four keys of sixteen is enough, wherever in their rows they are.
    expect(
      everyRowMoved(dial, still, [0, 0, 0, 3, 0, 2, 0, 0, 9, 0, 0, 0, 0, 0, 5, 0]),
    ).toBe(true)
  })

  it('is false when a row was left alone, however much the others moved', () => {
    // Every key of the first three rows, and nothing in the fourth — twelve presses and
    // no chain, which is the whole of what the rule asks.
    expect(
      everyRowMoved(dial, still, [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 0, 0, 0, 0]),
    ).toBe(false)
    expect(everyRowMoved(dial, still, still)).toBe(false)
  })

  it('reads a key wound back to where it started as untouched, as `everyKeyMoved` does', () => {
    const wound = oneEach.map((digit, index) =>
      index === 0 ? (still[index] ?? 0) : digit,
    )
    expect(everyRowMoved(dial, still, wound)).toBe(false)
  })

  it('refuses to compare grids of different dials', () => {
    expect(everyRowMoved(dial, still, [1, 2, 3, 4])).toBe(false)
  })

  it('is satisfied by every key moved, so it can never be stricter than `whole`', () => {
    const all = still.map((_, index) => index + 1)
    expect(everyKeyMoved(still, all)).toBe(true)
    expect(everyRowMoved(dial, still, all)).toBe(true)
  })

  it('asks for every row of a one-row dial, which is one key', () => {
    // The nine every shipped mode uses would ask for three. Not a rule for that dial —
    // see the comment on `STREAK_TRIGGERED.spread` — but the arithmetic has to hold for
    // any shape, because a dial is data.
    const row = defineDial({ id: 'test-one-row', rows: 1, cols: 4 })
    expect(everyRowMoved(row, [0, 0, 0, 0], [0, 0, 1, 0])).toBe(true)
    expect(everyRowMoved(row, [0, 0, 0, 0], [0, 0, 0, 0])).toBe(false)
  })
})

describe('the every-row streak', () => {
  it('builds on a hit whose route touched every row', () => {
    expect(STREAK_TRIGGERED.spread(facts({ anyHit: true, allSpread: true }))).toBe(true)
  })

  it('does not build on a hit that left a row alone', () => {
    expect(STREAK_TRIGGERED.spread(facts({ anyHit: true }))).toBe(false)
  })

  it('does not build on a batch with no hit in it', () => {
    expect(STREAK_TRIGGERED.spread(facts({ allSpread: true }))).toBe(false)
  })

  it('is broken by a hit that did not, which is what makes it a chain', () => {
    expect(STREAK_BROKEN.spread(facts({ anyHit: true }))).toBe(true)
    expect(STREAK_BROKEN.spread(facts())).toBe(false)
  })
})

describe('fresh', () => {
  it('builds on a batch that was all fresh, and breaks on any other hit', () => {
    expect(STREAK_TRIGGERED.fresh(facts({ anyHit: true, allFresh: true }))).toBe(true)
    expect(STREAK_TRIGGERED.fresh(facts({ anyHit: true, allFresh: false }))).toBe(false)
    expect(STREAK_BROKEN.fresh(facts({ anyHit: true }))).toBe(true)
  })

  it('does nothing without a hit', () => {
    expect(STREAK_TRIGGERED.fresh(facts({ allFresh: true }))).toBe(false)
    expect(STREAK_BROKEN.fresh(facts())).toBe(false)
  })
})
