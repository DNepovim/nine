import { describe, expect, it } from 'vitest'

import {
  averagePercent,
  boardRows,
  EMPTY_PROFILE,
  lifetimeOf,
  shapeProfile,
  sortReigns,
  type BoardTotals,
  type PlayerProfile,
  type Reign,
} from './player-profile'

const totals = (over: Partial<BoardTotals> = {}): BoardTotals => ({
  mode: 'accuracy',
  difficulty: 'hard',
  runs: 4,
  hits: 40,
  scoreSum: 8000,
  accSum: 34,
  spdSum: 20,
  ...over,
})

const profile = (over: Partial<PlayerProfile> = {}): PlayerProfile => ({
  ...EMPTY_PROFILE,
  nickname: 'ADA',
  ...over,
})

const reign = (over: Partial<Reign> = {}): Reign => ({
  mode: 'speed',
  difficulty: 'extreme',
  score: 20478,
  tookAt: '2026-08-12T10:00:00.000Z',
  lostAt: null,
  ...over,
})

describe('averagePercent', () => {
  it('is the factor sum over the hits, as a percentage', () => {
    expect(averagePercent(34, 40)).toBe(85)
  })

  it('is null with no hits — which is not the same as zero', () => {
    expect(averagePercent(0, 0)).toBeNull()
  })

  it('does not clamp a speed average the bonus pushed over 100', () => {
    expect(averagePercent(10.8, 10)).toBe(108)
  })
})

describe('lifetimeOf', () => {
  it('adds every board together', () => {
    expect(
      lifetimeOf([
        totals({ runs: 4, hits: 40, scoreSum: 8000, accSum: 34, spdSum: 20 }),
        totals({
          mode: 'speed',
          runs: 6,
          hits: 30,
          scoreSum: 12000,
          accSum: 21,
          spdSum: 26,
        }),
      ]),
    ).toEqual({ runs: 10, hits: 70, score: 20000, accSum: 55, spdSum: 46 })
  })

  it('sums both factors over every board, whichever mode it is', () => {
    // Each hit carries an accuracy and a speed factor in either mode, so a lifetime
    // average has both to average over — the same pair the game over screen shows.
    const { accSum, spdSum, hits } = lifetimeOf([
      totals({ mode: 'accuracy', hits: 40, accSum: 34, spdSum: 20 }),
      totals({ mode: 'speed', hits: 40, accSum: 20, spdSum: 34 }),
    ])
    expect(averagePercent(accSum, hits)).toBe(68)
    expect(averagePercent(spdSum, hits)).toBe(68)
  })

  it('is zeroes for a player with no counted runs', () => {
    expect(lifetimeOf([])).toEqual({ runs: 0, hits: 0, score: 0, accSum: 0, spdSum: 0 })
  })
})

describe('boardRows', () => {
  it('returns all six boards in mode-then-difficulty order', () => {
    expect(boardRows(profile()).map((row) => `${row.mode}:${row.difficulty}`)).toEqual([
      'accuracy:easy',
      'accuracy:hard',
      'accuracy:extreme',
      'speed:easy',
      'speed:hard',
      'speed:extreme',
    ])
  })

  it('judges an Accuracy board on accuracy and a Speed board on speed', () => {
    const rows = boardRows(
      profile({
        totals: [
          totals({ mode: 'accuracy', accSum: 34, spdSum: 10, hits: 40 }),
          totals({ mode: 'speed', accSum: 10, spdSum: 34, hits: 40 }),
        ],
      }),
    )
    const accuracy = rows.find((row) => row.mode === 'accuracy' && row.runs > 0)
    const speed = rows.find((row) => row.mode === 'speed' && row.runs > 0)
    expect(accuracy?.average).toBe(85)
    expect(speed?.average).toBe(85)
  })

  it('leaves a board with no counted runs empty rather than zeroed', () => {
    const row = boardRows(profile())[0]
    expect(row?.runs).toBe(0)
    expect(row?.average).toBeNull()
    expect(row?.best).toBeNull()
  })

  it('keeps a best set before the counters existed', () => {
    const rows = boardRows(
      profile({
        bests: [
          {
            mode: 'accuracy',
            difficulty: 'easy',
            score: 9000,
            hits: 30,
            achievedAt: '2026-07-01T09:00:00.000Z',
          },
        ],
      }),
    )
    const row = rows.find((entry) => entry.difficulty === 'easy')
    expect(row?.best).toBe(9000)
    expect(row?.runs).toBe(0)
  })
})

describe('sortReigns', () => {
  it('puts the most recent reign first', () => {
    const older = reign({ tookAt: '2026-06-01T00:00:00.000Z' })
    const newer = reign({ tookAt: '2026-08-12T00:00:00.000Z' })
    expect(sortReigns([older, newer])).toEqual([newer, older])
  })
})

describe('shapeProfile', () => {
  const rawTotals = {
    mode: 'accuracy',
    difficulty: 'hard',
    runs: 4,
    hits: 40,
    scoreSum: 8000,
    accSum: 34,
    spdSum: 20,
  }
  const rawBest = {
    mode: 'speed',
    difficulty: 'extreme',
    bestScore: 20478,
    hits: 31,
    achievedAt: '2026-08-12T10:00:00.000Z',
  }
  const rawMedal = {
    mode: 'speed',
    difficulty: 'extreme',
    period: 'ever',
    rank: 1,
    bestScore: 20478,
  }
  const raw = {
    nickname: 'ADA',
    totals: [rawTotals],
    bests: [rawBest],
    medals: [rawMedal],
    reigns: [
      {
        mode: 'speed',
        difficulty: 'extreme',
        score: 20478,
        tookAt: '2026-08-12T10:00:00.000Z',
        lostAt: null,
      },
    ],
  }

  it('narrows the server strings into boards', () => {
    const shaped = shapeProfile(raw)
    expect(shaped.nickname).toBe('ADA')
    expect(shaped.totals[0]?.mode).toBe('accuracy')
    expect(shaped.bests[0]?.score).toBe(20478)
    expect(shaped.medals[0]).toEqual({
      mode: 'speed',
      difficulty: 'extreme',
      period: 'ever',
      rank: 1,
    })
  })

  it('keeps one medal per mode, the way the intro line does', () => {
    // A player who holds a board all-time almost always holds it this week and today
    // too — left alone that is three entries saying one thing.
    const shaped = shapeProfile({
      ...raw,
      medals: [
        rawMedal,
        { ...rawMedal, period: 'week' },
        { ...rawMedal, period: 'today', rank: 2 },
      ],
    })
    expect(shaped.medals).toHaveLength(1)
    expect(shaped.medals[0]?.period).toBe('ever')
    expect(shaped.reigns[0]?.tookAt).toBe('2026-08-12T10:00:00.000Z')
  })

  it('drops a row on a board this client does not know', () => {
    const shaped = shapeProfile({
      ...raw,
      totals: [{ ...rawTotals, mode: 'trainee' }],
      bests: [{ ...rawBest, difficulty: 'medium' }],
    })
    expect(shaped.totals).toEqual([])
    expect(shaped.bests).toEqual([])
  })

  it('drops a standing that is not a medal', () => {
    const shaped = shapeProfile({
      ...raw,
      medals: [{ ...rawMedal, rank: 4 }],
    })
    expect(shaped.medals).toEqual([])
  })

  it('drops a rank one with no score behind it', () => {
    // `my_medals` ranks a player who has never posted first on an empty board.
    const shaped = shapeProfile({
      ...raw,
      medals: [{ ...rawMedal, rank: 1, bestScore: 0 }],
    })
    expect(shaped.medals).toEqual([])
  })

  it('reads a player with nothing on any board', () => {
    expect(
      shapeProfile({ nickname: null, totals: [], bests: [], medals: [], reigns: [] }),
    ).toEqual(EMPTY_PROFILE)
  })
})
