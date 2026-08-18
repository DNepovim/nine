import { describe, expect, it } from 'vitest'

import type { LeaderboardTab } from './leaderboard'
import {
  longestMedalTab,
  medalRank,
  toMedals,
  type BoardStanding,
  type TabRank,
} from './medals'

const standing = (over: Partial<BoardStanding> = {}): BoardStanding => ({
  mode: 'accuracy',
  difficulty: 'easy',
  period: 'ever',
  rank: 1,
  score: 100,
  ...over,
})

describe('medalRank', () => {
  it('gives the podium its place', () => {
    expect(medalRank(1, 100)).toBe(1)
    expect(medalRank(3, 100)).toBe(3)
  })

  it('is null off the podium', () => {
    expect(medalRank(4, 100)).toBeNull()
    expect(medalRank(57, 100)).toBeNull()
  })

  it('is null for a rank no score stands behind', () => {
    // What my_rank returns on an empty board for someone who has never played.
    expect(medalRank(1, 0)).toBeNull()
  })
})

describe('toMedals', () => {
  it('has nothing to show for a player who has never medalled', () => {
    expect(toMedals([])).toEqual([])
    expect(toMedals([standing({ rank: 4 })])).toEqual([])
  })

  it('shows at most one medal per mode', () => {
    const medals = toMedals([
      standing({ mode: 'accuracy', period: 'ever' }),
      standing({ mode: 'accuracy', period: 'week', difficulty: 'hard' }),
      standing({ mode: 'accuracy', period: 'today', difficulty: 'extreme' }),
      standing({ mode: 'speed', period: 'week' }),
      standing({ mode: 'speed', period: 'today' }),
    ])
    expect(medals).toHaveLength(2)
    expect(medals.map((m) => m.mode)).toEqual(['accuracy', 'speed'])
  })

  it('prefers the longer-standing board over the better metal', () => {
    // Gold for the week and silver all time: the silver shows.
    const medals = toMedals([
      standing({ period: 'week', rank: 1 }),
      standing({ period: 'ever', rank: 2 }),
    ])
    expect(medals).toEqual([
      { mode: 'accuracy', difficulty: 'easy', period: 'ever', rank: 2 },
    ])
  })

  it('drops the same metal on shorter boards', () => {
    // Gold all time, gold this week, gold today: only the all-time one shows.
    const medals = toMedals([
      standing({ period: 'today', rank: 1 }),
      standing({ period: 'week', rank: 1 }),
      standing({ period: 'ever', rank: 1 }),
    ])
    expect(medals).toEqual([
      { mode: 'accuracy', difficulty: 'easy', period: 'ever', rank: 1 },
    ])
  })

  it('prefers the week over the day even when the day holds the better metal', () => {
    // Silver today, bronze this week: the bronze shows.
    const medals = toMedals([
      standing({ period: 'today', rank: 2 }),
      standing({ period: 'week', rank: 3 }),
    ])
    expect(medals).toEqual([
      { mode: 'accuracy', difficulty: 'easy', period: 'week', rank: 3 },
    ])
  })

  it('takes the better metal when the period ties', () => {
    const medals = toMedals([
      standing({ period: 'week', rank: 3 }),
      standing({ period: 'week', rank: 1, difficulty: 'hard' }),
    ])
    expect(medals[0]?.rank).toBe(1)
  })

  it('takes the harder board when period and metal both tie', () => {
    const medals = toMedals([
      standing({ period: 'ever', rank: 1, difficulty: 'easy' }),
      standing({ period: 'ever', rank: 1, difficulty: 'extreme' }),
    ])
    expect(medals[0]?.difficulty).toBe('extreme')
  })

  it('keeps each mode in its own slot regardless of metal', () => {
    // Speed holds the better medal, but accuracy still comes first.
    const medals = toMedals([
      standing({ mode: 'speed', rank: 1 }),
      standing({ mode: 'accuracy', rank: 3 }),
    ])
    expect(medals.map((m) => m.mode)).toEqual(['accuracy', 'speed'])
  })
})

describe('longestMedalTab', () => {
  const NONE: Record<LeaderboardTab, TabRank> = {
    today: null,
    week: null,
    forever: null,
  }

  it('is null when nothing is a medal', () => {
    expect(longestMedalTab(NONE)).toBeNull()
    expect(longestMedalTab({ ...NONE, today: { rank: 5, score: 100 } })).toBeNull()
  })

  it('is null for a rank no score stands behind', () => {
    // What my_rank returns on an empty board for someone who has never played.
    expect(longestMedalTab({ ...NONE, forever: { rank: 1, score: 0 } })).toBeNull()
  })

  it('picks the only medal on offer', () => {
    expect(longestMedalTab({ ...NONE, week: { rank: 3, score: 40 } })).toBe('week')
  })

  it('prefers forever over week, and week over today', () => {
    expect(
      longestMedalTab({
        today: { rank: 1, score: 10 },
        week: { rank: 1, score: 10 },
        forever: { rank: 1, score: 10 },
      }),
    ).toBe('forever')

    expect(
      longestMedalTab({
        today: { rank: 1, score: 10 },
        week: { rank: 1, score: 10 },
        forever: null,
      }),
    ).toBe('week')
  })

  it('lets a bronze on the longer board beat a gold on the shorter one', () => {
    // Gold today, bronze this week: the week wins on range, not on metal.
    expect(
      longestMedalTab({
        today: { rank: 1, score: 500 },
        week: { rank: 3, score: 300 },
        forever: null,
      }),
    ).toBe('week')
  })
})
