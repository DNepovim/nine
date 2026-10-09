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
  rank: 1,
  ...over,
})

describe('winFactor', () => {
  it('pays a week the board score weight', () => {
    expect(winFactor('week', 'easy', 1)).toBe(0.5)
    expect(winFactor('week', 'hard', 1)).toBe(1)
    expect(winFactor('week', 'extreme', 1)).toBe(2)
  })

  it('pays a day exactly half of its week', () => {
    expect(winFactor('day', 'easy', 1)).toBe(0.25)
    expect(winFactor('day', 'hard', 1)).toBe(0.5)
    expect(winFactor('day', 'extreme', 1)).toBe(1)
  })

  it('pays second place half of the gold it stood beside', () => {
    expect(winFactor('day', 'extreme', 2)).toBe(0.5)
    expect(winFactor('week', 'easy', 2)).toBe(0.25)
    expect(winFactor('week', 'extreme', 2)).toBe(1)
  })

  it('pays third place a tenth of it', () => {
    expect(winFactor('day', 'extreme', 3)).toBeCloseTo(0.1)
    expect(winFactor('week', 'extreme', 3)).toBeCloseTo(0.2)
  })

  // The backfilled fortune rests on this: rank one has to pay exactly what the function
  // paid before the podium existed, on every board, or every player's figure moves.
  it('leaves rank one paying what it always paid', () => {
    const before = {
      day: { easy: 0.25, hard: 0.5, extreme: 1 },
      week: { easy: 0.5, hard: 1, extreme: 2 },
    } as const
    for (const period of ['day', 'week'] as const) {
      for (const difficulty of ['easy', 'hard', 'extreme'] as const) {
        expect(winFactor(period, difficulty, 1)).toBe(before[period][difficulty])
      }
    }
  })

  // A podium step is a share of its own window, not a flat figure: a second place on an
  // Extreme week still outpays a first on an Easy day.
  it('keeps a harder board’s lesser step above an easier board’s better one', () => {
    expect(winFactor('week', 'extreme', 2)).toBeGreaterThan(winFactor('day', 'easy', 1))
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

  it('pays a third place on an extreme day a tenth of its score', () => {
    expect(awardPoints(award({ score: 31219, rank: 3 }))).toBe(3122)
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

  // The tenths a third place introduces are the reason the round-once rule got stricter
  // rather than looser: four of these land on 100.4, and rounding each first gives 100.
  it('rounds once over the hundredths a third place introduces', () => {
    const third = award({ difficulty: 'easy', score: 1004, rank: 3 })
    expect(totalAwards([third, third, third, third])).toBe(100)
    expect(totalAwards([third, third, third, third, third])).toBe(126)
  })

  it('adds a full podium on one board', () => {
    expect(
      totalAwards([
        award({ score: 1000, rank: 1 }),
        award({ score: 800, rank: 2 }),
        award({ score: 600, rank: 3 }),
      ]),
    ).toBe(1000 + 400 + 60)
  })
})

describe('winningsValue', () => {
  const board = (over: Partial<BoardWinnings> = {}): BoardWinnings => ({
    mode: 'speed',
    difficulty: 'extreme',
    period: 'day',
    rank: 1,
    scoreSum: 0,
    ...over,
  })

  it('is zero with no boards', () => {
    expect(winningsValue([])).toBe(0)
  })

  it('weights a day row and a week row separately', () => {
    expect(
      winningsValue([
        board({ period: 'day', scoreSum: 100 }),
        board({ period: 'week', scoreSum: 100 }),
      ]),
    ).toBe(300)
  })

  it('adds across boards of different difficulty', () => {
    expect(
      winningsValue([
        board({ difficulty: 'easy', period: 'day', scoreSum: 1000 }),
        board({ difficulty: 'hard', period: 'week', scoreSum: 1000 }),
      ]),
    ).toBe(250 + 1000)
  })

  it('weights each step of the podium on the same board', () => {
    expect(
      winningsValue([
        board({ rank: 1, scoreSum: 1000 }),
        board({ rank: 2, scoreSum: 1000 }),
        board({ rank: 3, scoreSum: 1000 }),
      ]),
    ).toBeCloseTo(1000 + 500 + 100)
  })

  it('stays unrounded so the caller can round once', () => {
    expect(winningsValue([board({ difficulty: 'easy', scoreSum: 1001 })])).toBe(250.25)
  })
})
