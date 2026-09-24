import { describe, expect, it } from 'vitest'

import type { MedalLoss, Taker } from '@/lib/lost-medals'
import {
  prunedHistory,
  recordTaken,
  toMedalHistory,
  type TakenMedal,
} from '@/lib/medal-history'
import type { MedalPeriod } from '@/lib/medals'
import type { Difficulty, ScoredMode } from '@/machines/game'

const TAKER: Taker = { userId: 'u1', nickname: 'RIVAL' }

const loss = (
  period: MedalPeriod,
  had: 1 | 2 | 3,
  {
    mode = 'speed',
    difficulty = 'hard',
  }: { mode?: ScoredMode; difficulty?: Difficulty } = {},
): MedalLoss => ({ mode, difficulty, period, had, now: null })

const taken = (
  day: string,
  period: MedalPeriod,
  had: 1 | 2 | 3,
  {
    mode = 'speed',
    difficulty = 'hard',
    taker = TAKER,
  }: { mode?: ScoredMode; difficulty?: Difficulty; taker?: Taker | null } = {},
): TakenMedal => ({ mode, difficulty, period, had, taker, day })

describe('recordTaken', () => {
  it('writes down a loss with the name it came with', () => {
    expect(
      recordTaken([], [{ loss: loss('ever', 1), taker: TAKER }], '2026-09-23'),
    ).toEqual([taken('2026-09-23', 'ever', 1)])
  })

  it('keeps a loss the board could not name', () => {
    const history = recordTaken(
      [],
      [{ loss: loss('week', 2), taker: null }],
      '2026-09-23',
    )
    expect(history).toEqual([taken('2026-09-23', 'week', 2, { taker: null })])
  })

  it('records the same medal on the same day once', () => {
    const already = [taken('2026-09-23', 'ever', 1)]
    const again = recordTaken(
      already,
      [{ loss: loss('ever', 1), taker: null }],
      '2026-09-23',
    )
    expect(again).toEqual(already)
  })

  it('records the same medal again on a later day', () => {
    const already = [taken('2026-09-22', 'ever', 1)]
    const next = recordTaken(
      already,
      [{ loss: loss('ever', 1), taker: TAKER }],
      '2026-09-23',
    )
    expect(next.map((row) => row.day)).toEqual(['2026-09-23', '2026-09-22'])
  })

  it('drops what has aged out of the week, today included in the seven', () => {
    const history = [
      taken('2026-09-23', 'ever', 1),
      // Seven days counting today: the 17th is still in, the 16th is not.
      taken('2026-09-17', 'week', 2),
      taken('2026-09-16', 'today', 3),
    ]
    expect(prunedHistory(history, '2026-09-23').map((row) => row.day)).toEqual([
      '2026-09-23',
      '2026-09-17',
    ])
  })

  it('reads newest first, and the biggest claim first within a day', () => {
    const history = recordTaken(
      [],
      [
        { loss: loss('today', 1), taker: TAKER },
        { loss: loss('ever', 3), taker: TAKER },
      ],
      '2026-09-23',
    )
    expect(history.map((row) => row.period)).toEqual(['ever', 'today'])
  })

  it('leaves the stored name alone when the board has since moved on', () => {
    const already = [taken('2026-09-23', 'ever', 1)]
    const next = recordTaken(
      already,
      [{ loss: loss('ever', 1), taker: { userId: 'u2', nickname: 'SOMEBODY ELSE' } }],
      '2026-09-23',
    )
    expect(next[0]?.taker).toEqual(TAKER)
  })
})

describe('toMedalHistory', () => {
  it('reads back what was written', () => {
    const history = [taken('2026-09-23', 'ever', 1), taken('2026-09-22', 'week', 3)]
    expect(toMedalHistory(JSON.parse(JSON.stringify(history)))).toEqual(history)
  })

  it('answers empty for anything that is not a list', () => {
    expect(toMedalHistory(null)).toEqual([])
    expect(toMedalHistory({ day: '2026-09-23' })).toEqual([])
  })

  it('drops rows a build cannot read rather than defaulting them', () => {
    const rows = [
      taken('2026-09-23', 'ever', 1),
      {
        mode: 'arcade',
        difficulty: 'hard',
        period: 'ever',
        had: 1,
        taker: null,
        day: 'x',
      },
      {
        mode: 'speed',
        difficulty: 'hard',
        period: 'ever',
        had: 4,
        taker: null,
        day: 'x',
      },
      { mode: 'speed', difficulty: 'hard', period: 'ever', had: 1, taker: null },
    ]
    expect(toMedalHistory(rows)).toEqual([taken('2026-09-23', 'ever', 1)])
  })

  it('drops a taker that is missing half its name', () => {
    const rows = [{ ...taken('2026-09-23', 'ever', 1), taker: { userId: 'u1' } }]
    expect(toMedalHistory(rows)).toEqual([])
  })
})
