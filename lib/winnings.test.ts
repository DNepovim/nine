import { describe, expect, it } from 'vitest'

import {
  awardPoints,
  totalAwards,
  winFactor,
  winningsValue,
  type Award,
  type BoardWinnings,
} from '@/lib/winnings'

const award = (over: Partial<Award> = {}): Award => ({
  period: 'day',
  mode: 'speed',
  difficulty: 'extreme',
  wonOn: '2026-09-22',
  score: 1000,
  ...over,
})

describe('winFactor', () => {
  it('pays a week the board score weight', () => {
    expect(winFactor('week', 'easy')).toBe(0.5)
    expect(winFactor('week', 'hard')).toBe(1)
    expect(winFactor('week', 'extreme')).toBe(2)
  })

  it('pays a day exactly half of its week', () => {
    expect(winFactor('day', 'easy')).toBe(0.25)
    expect(winFactor('day', 'hard')).toBe(0.5)
    expect(winFactor('day', 'extreme')).toBe(1)
  })
})

describe('awardPoints', () => {
  it('pays an extreme day the score itself', () => {
    expect(awardPoints(award({ score: 31219 }))).toBe(31219)
  })

  it('pays an extreme week double the score', () => {
    expect(awardPoints(award({ period: 'week', score: 31219 }))).toBe(62438)
  })

  it('pays a hard day half the score', () => {
    expect(awardPoints(award({ difficulty: 'hard', score: 9404 }))).toBe(4702)
  })

  it('rounds an easy day that lands between points', () => {
    // 1001 × 0.25 = 250.25
    expect(awardPoints(award({ difficulty: 'easy', score: 1001 }))).toBe(250)
  })
})

describe('totalAwards', () => {
  it('is zero for a player who won nothing', () => {
    expect(totalAwards([])).toBe(0)
  })

  it('stacks a day and a week won on the same board', () => {
    expect(
      totalAwards([
        award({ score: 31219 }),
        award({ period: 'week', score: 31219, wonOn: '2026-09-14' }),
      ]),
    ).toBe(31219 * 3)
  })

  it('rounds once at the end rather than per award', () => {
    // Three easy days at 250.25 each: 750.75 → 751. Rounding each first gives 750.
    const easy = award({ difficulty: 'easy', score: 1001 })
    expect(totalAwards([easy, easy, easy])).toBe(751)
  })
})

describe('winningsValue', () => {
  const board = (over: Partial<BoardWinnings> = {}): BoardWinnings => ({
    mode: 'speed',
    difficulty: 'extreme',
    daySum: 0,
    weekSum: 0,
    ...over,
  })

  it('is zero with no boards', () => {
    expect(winningsValue([])).toBe(0)
  })

  it('weights day sums and week sums separately', () => {
    expect(winningsValue([board({ daySum: 100, weekSum: 100 })])).toBe(300)
  })

  it('adds across boards of different difficulty', () => {
    expect(
      winningsValue([
        board({ difficulty: 'easy', daySum: 1000 }),
        board({ difficulty: 'hard', weekSum: 1000 }),
      ]),
    ).toBe(250 + 1000)
  })

  it('stays unrounded so the caller can round once', () => {
    expect(winningsValue([board({ difficulty: 'easy', daySum: 1001 })])).toBe(250.25)
  })
})
