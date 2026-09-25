import { describe, expect, it } from 'vitest'

import { COMPARE_STATS, compareProfiles, JUDGED_STATS } from './compare'
import { EMPTY_PROFILE, type BoardTotals, type PlayerProfile } from './player-profile'

const totals = (over: Partial<BoardTotals> = {}): BoardTotals => ({
  mode: 'accuracy',
  difficulty: 'hard',
  runs: 0,
  hits: 0,
  scoreSum: 0,
  accSum: 0,
  spdSum: 0,
  timeMs: 0,
  ...over,
})

const profile = (over: Partial<PlayerProfile> = {}): PlayerProfile => ({
  ...EMPTY_PROFILE,
  ...over,
})

// The row for one stat, pulled out of the lifetime list so a test can say what it means
// rather than counting positions.
const stat = (
  mine: PlayerProfile,
  theirs: PlayerProfile,
  which: (typeof COMPARE_STATS)[number],
) => {
  const row = compareProfiles(mine, theirs).lifetime.find((it) => it.stat === which)
  if (row === undefined) throw new Error(`no ${which} row`)
  return row
}

describe('compareProfiles', () => {
  it('puts every stat on the table once, in order', () => {
    const { lifetime } = compareProfiles(profile(), profile())
    expect(lifetime.map((row) => row.stat)).toEqual([...COMPARE_STATS])
  })

  it('reads each side from its own profile', () => {
    const row = stat(
      profile({ totals: [totals({ runs: 12 })] }),
      profile({ totals: [totals({ runs: 5 })] }),
      'runs',
    )
    expect(row.mine).toBe(12)
    expect(row.theirs).toBe(5)
  })

  it('gives the judged rows to whichever side is higher', () => {
    const sharper = profile({ totals: [totals({ hits: 10, accSum: 900 })] })
    const blunter = profile({ totals: [totals({ hits: 10, accSum: 800 })] })
    expect(stat(sharper, blunter, 'accuracy').leader).toBe('mine')
    expect(stat(blunter, sharper, 'accuracy').leader).toBe('theirs')
  })

  it('leaves the volume rows unjudged however far apart they are', () => {
    const mine = profile({ totals: [totals({ runs: 999, hits: 999, timeMs: 999_999 })] })
    const theirs = profile()
    expect(stat(mine, theirs, 'runs').leader).toBeNull()
    expect(stat(mine, theirs, 'hits').leader).toBeNull()
    expect(stat(mine, theirs, 'time').leader).toBeNull()
  })

  it('judges exactly the four quality stats, even when every row differs', () => {
    const { lifetime } = compareProfiles(
      profile({
        achievements: 4,
        totals: [
          totals({
            runs: 9,
            hits: 9,
            scoreSum: 900,
            accSum: 810,
            spdSum: 720,
            timeMs: 90,
          }),
        ],
      }),
      profile({
        achievements: 1,
        totals: [
          totals({
            runs: 2,
            hits: 2,
            scoreSum: 100,
            accSum: 100,
            spdSum: 80,
            timeMs: 20,
          }),
        ],
      }),
    )
    expect(lifetime.filter((row) => row.leader !== null).map((row) => row.stat)).toEqual([
      ...JUDGED_STATS,
    ])
  })

  it('names no leader when the two are level', () => {
    const both = profile({ achievements: 3 })
    expect(stat(both, both, 'achievements').leader).toBeNull()
  })

  it('names no leader when neither side has the stat at all', () => {
    expect(stat(profile(), profile(), 'accuracy').leader).toBeNull()
    expect(stat(profile(), profile(), 'accuracy').mine).toBeNull()
  })

  it('gives the row to the only side that has played it', () => {
    const mine = profile({ totals: [totals({ hits: 4, spdSum: 300 })] })
    expect(stat(mine, profile(), 'speed').leader).toBe('mine')
    expect(stat(profile(), mine, 'speed').leader).toBe('theirs')
  })

  it('counts an achievement hoard no bigger than the catalogue this build knows', () => {
    const row = stat(
      profile({ achievements: 9_999 }),
      profile({ achievements: 1 }),
      'achievements',
    )
    expect(row.mine).toBeLessThan(9_999)
    expect(row.leader).toBe('mine')
  })

  it('lays the boards out one block per mode, three rows each in difficulty order', () => {
    const { boards } = compareProfiles(profile(), profile())
    expect(boards.map((block) => block.mode)).toEqual(['accuracy', 'speed'])
    expect(boards[0]?.rows.map((row) => row.difficulty)).toEqual([
      'easy',
      'hard',
      'extreme',
    ])
  })

  it('compares each board on its best score', () => {
    const mine = profile({
      bests: [
        {
          mode: 'speed',
          difficulty: 'extreme',
          score: 1_200,
          hits: 9,
          achievedAt: '2026-01-01',
        },
      ],
    })
    const theirs = profile({
      bests: [
        {
          mode: 'speed',
          difficulty: 'extreme',
          score: 900,
          hits: 7,
          achievedAt: '2026-01-01',
        },
      ],
    })
    const row = compareProfiles(mine, theirs)
      .boards.find((block) => block.mode === 'speed')
      ?.rows.find((it) => it.difficulty === 'extreme')
    expect(row?.mine).toBe(1_200)
    expect(row?.theirs).toBe(900)
    expect(row?.leader).toBe('mine')
  })

  it('leaves a board neither has played with two blanks and no leader', () => {
    const row = compareProfiles(profile(), profile())
      .boards.find((block) => block.mode === 'accuracy')
      ?.rows.find((it) => it.difficulty === 'easy')
    expect(row?.mine).toBeNull()
    expect(row?.theirs).toBeNull()
    expect(row?.leader).toBeNull()
  })
})
