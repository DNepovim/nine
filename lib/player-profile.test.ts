import { describe, expect, it } from 'vitest'

import {
  averagePercent,
  boardRows,
  EMPTY_PROFILE,
  fortuneOf,
  heldBoards,
  lifetimeOf,
  shapeProfile,
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
  bestAcc: 0,
  bestSpd: 0,
  timeMs: 90_000,
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
  period: 'ever',
  from: '2026-08-12T10:00:00.000Z',
  to: null,
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
    ).toEqual({
      runs: 10,
      hits: 70,
      score: 20000,
      timeMs: 180_000,
      fortune: 20000,
      accSum: 55,
      spdSum: 46,
    })
  })

  it('adds the time every board was played for', () => {
    // The one counter the lifetime row could not answer before the server kept it.
    const lifetime = lifetimeOf([
      totals({ timeMs: 90_000 }),
      totals({ mode: 'speed', timeMs: 150_000 }),
    ])
    expect(lifetime.timeMs).toBe(240_000)
  })

  it('weights every board by the difficulty it was scored on', () => {
    // Easy at half, Hard at itself, Extreme at double — so the same ten thousand points
    // is worth 5 000, 10 000 or 20 000 depending on where it was spent.
    const fortune = (difficulty: BoardTotals['difficulty']) =>
      lifetimeOf([totals({ difficulty, scoreSum: 10000 })]).fortune
    expect(fortune('easy')).toBe(5000)
    expect(fortune('hard')).toBe(10000)
    expect(fortune('extreme')).toBe(20000)
  })

  it('keeps the raw total beside the fortune, so the per-board table still adds up', () => {
    const lifetime = lifetimeOf([
      totals({ difficulty: 'easy', scoreSum: 10000 }),
      totals({ difficulty: 'extreme', scoreSum: 10000 }),
    ])
    expect(lifetime.score).toBe(20000)
    expect(lifetime.fortune).toBe(25000)
  })

  it('rounds the fortune once, not once per board', () => {
    // Half-weighting an odd total lands on a half point. Three of them rounded apart
    // would come to 4 503 and disagree with the boards they were added from.
    const odd = totals({ difficulty: 'easy', scoreSum: 3001 })
    expect(lifetimeOf([odd, odd, odd]).fortune).toBe(4502)
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
    expect(lifetimeOf([])).toEqual({
      runs: 0,
      hits: 0,
      score: 0,
      timeMs: 0,
      fortune: 0,
      accSum: 0,
      spdSum: 0,
    })
  })
})

describe('fortuneOf', () => {
  it('weights one run by the board it was played on', () => {
    expect(fortuneOf(10000, 'easy')).toBe(5000)
    expect(fortuneOf(10000, 'hard')).toBe(10000)
    expect(fortuneOf(10000, 'extreme')).toBe(20000)
  })

  it('rounds a half point rather than showing one', () => {
    expect(fortuneOf(3001, 'easy')).toBe(1501)
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
    expect(row?.bestFactor).toBeNull()
  })

  it('takes the best run from the factor its own mode is judged on', () => {
    const rows = boardRows(
      profile({
        totals: [
          totals({ mode: 'accuracy', bestAcc: 96.5, bestSpd: 71.5 }),
          totals({ mode: 'speed', bestAcc: 71.5, bestSpd: 96.5 }),
        ],
      }),
    )
    expect(rows.find((row) => row.mode === 'accuracy' && row.runs > 0)?.bestFactor).toBe(
      97,
    )
    expect(rows.find((row) => row.mode === 'speed' && row.runs > 0)?.bestFactor).toBe(97)
  })

  it('reads a board played before the server kept a best as nothing, not as zero', () => {
    const rows = boardRows(profile({ totals: [totals({ bestAcc: 0, bestSpd: 0 })] }))
    const row = rows.find((entry) => entry.runs > 0)
    expect(row?.average).not.toBeNull()
    expect(row?.bestFactor).toBeNull()
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

describe('heldBoards', () => {
  it('puts the most recent stretch first', () => {
    const older = reign({ from: '2026-06-01T00:00:00.000Z' })
    const newer = reign({ from: '2026-08-12T00:00:00.000Z' })
    expect(heldBoards([older, newer])).toEqual([newer, older])
  })

  it('orders an all-time instant against a bare day without a Date in sight', () => {
    // The two periods carry two granularities. A string compare has to get this right
    // on its own, because nothing converts them to a common one first.
    const august = reign({ from: '2026-08-12T10:00:00.000Z' })
    const july = reign({ period: 'day', from: '2026-07-04', to: '2026-07-04' })
    expect(heldBoards([july, august])).toEqual([august, july])
  })

  it('caps the list at twenty rows', () => {
    const days = Array.from({ length: 40 }, (_, i) =>
      reign({
        period: 'day',
        from: `2026-03-${String(i + 1).padStart(2, '0')}`,
        to: '2026-03-01',
      }),
    )
    expect(heldBoards(days)).toHaveLength(20)
  })

  it('keeps the newest windows when it has to drop some', () => {
    const days = Array.from({ length: 25 }, (_, i) =>
      reign({
        period: 'day',
        from: `2026-03-${String(i + 1).padStart(2, '0')}`,
        to: '2026-03-01',
      }),
    )
    const kept = heldBoards(days)
    expect(kept[0]?.from).toBe('2026-03-25')
    expect(kept.at(-1)?.from).toBe('2026-03-06')
  })

  it('keeps every all-time stretch past the cap, dropping windows instead', () => {
    // An all-time board is the rarest thing on the list and the one a player would most
    // notice missing. There are only ever a handful, so exempting them cannot run away.
    const allTime = Array.from({ length: 6 }, (_, i) =>
      reign({ from: `2026-01-0${i + 1}T00:00:00.000Z` }),
    )
    const days = Array.from({ length: 40 }, (_, i) =>
      reign({
        period: 'day',
        from: `2026-05-${String((i % 28) + 1).padStart(2, '0')}`,
        to: '2026-05-01',
      }),
    )
    const kept = heldBoards([...allTime, ...days])
    expect(kept).toHaveLength(20)
    expect(kept.filter((held) => held.period === 'ever')).toHaveLength(6)
  })

  it('never drops an all-time stretch even when they alone exceed the cap', () => {
    const many = Array.from({ length: 24 }, (_, i) =>
      reign({ from: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z` }),
    )
    expect(heldBoards(many)).toHaveLength(24)
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
    expect(shaped.reigns[0]?.from).toBe('2026-08-12T10:00:00.000Z')
  })

  it('merges the derived day and week stretches in with the stored ones', () => {
    const shaped = shapeProfile({
      ...raw,
      wins: [
        {
          mode: 'accuracy',
          difficulty: 'easy',
          period: 'day',
          fromDay: '2026-08-01',
          toDay: '2026-08-03',
        },
        {
          mode: 'speed',
          difficulty: 'hard',
          period: 'week',
          fromDay: '2026-09-07',
          toDay: '2026-09-13',
        },
      ],
    })
    expect(shaped.reigns).toHaveLength(3)
    // Newest first, across all three periods rather than within each.
    expect(shaped.reigns.map((held) => held.period)).toEqual(['week', 'ever', 'day'])
  })

  it('keeps a one-day stretch as a day at both ends', () => {
    // What the row reads as a single date rather than as a range of one day to itself.
    const shaped = shapeProfile({
      ...raw,
      reigns: [],
      wins: [
        {
          mode: 'accuracy',
          difficulty: 'easy',
          period: 'day',
          fromDay: '2026-08-07',
          toDay: '2026-08-07',
        },
      ],
    })
    expect(shaped.reigns[0]?.from).toBe('2026-08-07')
    expect(shaped.reigns[0]?.to).toBe('2026-08-07')
  })

  it('drops a win on a period this client does not know', () => {
    const shaped = shapeProfile({
      ...raw,
      reigns: [],
      wins: [
        {
          mode: 'accuracy',
          difficulty: 'easy',
          period: 'fortnight',
          fromDay: '2026-08-01',
          toDay: '2026-08-14',
        },
      ],
    })
    expect(shaped.reigns).toEqual([])
  })

  it('reads a server that does not derive held windows yet as none', () => {
    // The migration ships separately from the build, so a client can reach a server that
    // has not run it. Absent means the all-time stretches alone, not a broken profile.
    const shaped = shapeProfile(raw)
    expect(shaped.reigns).toHaveLength(1)
    expect(shaped.reigns[0]?.period).toBe('ever')
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

  it('reads the achievement count straight through', () => {
    expect(shapeProfile({ ...raw, achievements: 12 }).achievements).toBe(12)
  })

  it('reads the motto straight through', () => {
    expect(shapeProfile({ ...raw, motto: 'I dial faster than I think' }).motto).toBe(
      'I dial faster than I think',
    )
  })

  it('reads a server that does not know about mottoes yet as having none', () => {
    // Same reason as the achievement count below: the column ships in its own migration,
    // and a client can reach a server that has not run it. Absent is a player with no
    // motto, which is what most players are anyway.
    expect(shapeProfile(raw).motto).toBeNull()
  })

  it('reads the best run on each factor straight through', () => {
    const shaped = shapeProfile({
      ...raw,
      totals: [{ ...rawTotals, bestAcc: 96.5, bestSpd: 71.5 }],
    })
    expect(shaped.totals[0]?.bestAcc).toBe(96.5)
    expect(shaped.totals[0]?.bestSpd).toBe(71.5)
  })

  it('reads a server that does not keep a best run yet as none kept', () => {
    // The columns ship in their own migration, and a client can reach a server that has
    // not run it. Zero is what `boardRows` then draws as a dash — the board has a best,
    // the server just has never been told what it was.
    expect(shapeProfile(raw).totals[0]?.bestAcc).toBe(0)
    expect(shapeProfile(raw).totals[0]?.bestSpd).toBe(0)
  })

  it('reads a server that does not count achievements yet as none', () => {
    // The RPC that answers it ships in its own migration, and a client can reach a
    // server that has not run it. Absent is not a number, and zero is the only reading
    // that cannot overstate what the player holds.
    expect(shapeProfile(raw).achievements).toBe(0)
  })

  it('reads a player with nothing on any board', () => {
    expect(
      shapeProfile({ nickname: null, totals: [], bests: [], medals: [], reigns: [] }),
    ).toEqual(EMPTY_PROFILE)
  })
})
