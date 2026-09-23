import { describe, expect, it } from 'vitest'

import type { LeaderboardRow } from '@/lib/leaderboard'
import {
  announcedLosses,
  lostMedals,
  takerOf,
  toSeenStandings,
  type MedalLoss,
  type SeenStandings,
} from '@/lib/lost-medals'
import type { BoardStanding, MedalPeriod } from '@/lib/medals'
import type { Difficulty, ScoredMode } from '@/machines/game'

const standing = (
  period: MedalPeriod,
  rank: number,
  {
    mode = 'speed',
    difficulty = 'hard',
    score = 5000,
  }: { mode?: ScoredMode; difficulty?: Difficulty; score?: number } = {},
): BoardStanding => ({ mode, difficulty, period, rank, score })

const seenOn = (day: string, standings: BoardStanding[]): SeenStandings => ({
  day,
  standings,
})

describe('lostMedals', () => {
  it('reports a medal the player no longer stands on at all', () => {
    const seen = seenOn('2026-09-23', [standing('ever', 1)])
    expect(lostMedals(seen, [], '2026-09-23')).toEqual([
      { mode: 'speed', difficulty: 'hard', period: 'ever', had: 1, now: null },
    ])
  })

  it('reports a medal that dropped to a lesser metal', () => {
    const seen = seenOn('2026-09-23', [standing('ever', 1)])
    const now = [standing('ever', 3)]
    expect(lostMedals(seen, now, '2026-09-23')).toEqual([
      { mode: 'speed', difficulty: 'hard', period: 'ever', had: 1, now: 3 },
    ])
  })

  it('says nothing when the standing is unchanged', () => {
    const seen = seenOn('2026-09-23', [standing('ever', 2)])
    expect(lostMedals(seen, [standing('ever', 2)], '2026-09-23')).toEqual([])
  })

  it('says nothing when the player climbed', () => {
    const seen = seenOn('2026-09-23', [standing('ever', 3)])
    expect(lostMedals(seen, [standing('ever', 1)], '2026-09-23')).toEqual([])
  })

  it('says nothing about a place that was never a medal', () => {
    const seen = seenOn('2026-09-23', [standing('ever', 7)])
    expect(lostMedals(seen, [], '2026-09-23')).toEqual([])
  })

  it('says nothing about a rank held with no score behind it', () => {
    const seen = seenOn('2026-09-23', [standing('ever', 1, { score: 0 })])
    expect(lostMedals(seen, [], '2026-09-23')).toEqual([])
  })

  it('does not blame a rival for the day board rolling over', () => {
    const seen = seenOn('2026-09-22', [standing('today', 1)])
    expect(lostMedals(seen, [], '2026-09-23')).toEqual([])
  })

  it('still reports a day medal lost inside the same day', () => {
    const seen = seenOn('2026-09-23', [standing('today', 1)])
    expect(lostMedals(seen, [], '2026-09-23')).toHaveLength(1)
  })

  it('does not blame a rival for the week board rolling over', () => {
    // 2026-09-27 is a Sunday, 2026-09-28 the Monday that empties the week board.
    const seen = seenOn('2026-09-27', [standing('week', 1)])
    expect(lostMedals(seen, [], '2026-09-28')).toEqual([])
  })

  it('still reports a week medal lost inside the same week', () => {
    const seen = seenOn('2026-09-22', [standing('week', 1)])
    expect(lostMedals(seen, [], '2026-09-27')).toHaveLength(1)
  })

  it('reports an all-time medal however long the player was away', () => {
    const seen = seenOn('2025-01-01', [standing('ever', 2)])
    expect(lostMedals(seen, [], '2026-09-23')).toHaveLength(1)
  })

  it('tells one board from another', () => {
    const seen = seenOn('2026-09-23', [standing('ever', 1, { difficulty: 'extreme' })])
    const now = [standing('ever', 1, { difficulty: 'hard' })]
    expect(lostMedals(seen, now, '2026-09-23')).toEqual([
      { mode: 'speed', difficulty: 'extreme', period: 'ever', had: 1, now: null },
    ])
  })
})

describe('announcedLosses', () => {
  it('says nothing when nothing was taken', () => {
    expect(announcedLosses([])).toEqual([])
  })

  it('leads with the longer-standing board over the better metal', () => {
    const seen = seenOn('2026-09-23', [standing('today', 1), standing('ever', 3)])
    const order = announcedLosses(lostMedals(seen, [], '2026-09-23'))
    expect(order.map((loss) => loss.period)).toEqual(['ever', 'today'])
  })

  it('leads with the better metal within one period', () => {
    const seen = seenOn('2026-09-23', [
      standing('ever', 3, { difficulty: 'easy' }),
      standing('ever', 1, { difficulty: 'hard' }),
    ])
    expect(announcedLosses(lostMedals(seen, [], '2026-09-23')).map((l) => l.had)).toEqual(
      [1, 3],
    )
  })

  it('keeps at most three, dropping the smallest claims', () => {
    const seen = seenOn('2026-09-23', [
      standing('today', 3, { difficulty: 'easy' }),
      standing('today', 1, { difficulty: 'hard' }),
      standing('week', 2, { difficulty: 'hard' }),
      standing('ever', 1, { difficulty: 'extreme' }),
    ])
    const order = announcedLosses(lostMedals(seen, [], '2026-09-23'))
    expect(order.map((loss) => loss.period)).toEqual(['ever', 'week', 'today'])
    expect(order.map((loss) => loss.had)).toEqual([1, 2, 1])
  })

  it('leaves the list it was given alone', () => {
    const seen = seenOn('2026-09-23', [standing('today', 1), standing('ever', 3)])
    const losses = lostMedals(seen, [], '2026-09-23')
    announcedLosses(losses)
    expect(losses.map((loss) => loss.period)).toEqual(['today', 'ever'])
  })
})

describe('toSeenStandings', () => {
  it('reads back what was written', () => {
    const seen = seenOn('2026-09-23', [standing('ever', 1)])
    expect(toSeenStandings(JSON.parse(JSON.stringify(seen)))).toEqual(seen)
  })

  it('rejects a value that is not a snapshot', () => {
    expect(toSeenStandings(null)).toBeNull()
    expect(toSeenStandings({ standings: [] })).toBeNull()
    expect(toSeenStandings({ day: '2026-09-23' })).toBeNull()
  })

  it('drops a row it cannot read rather than defaulting it', () => {
    const read = toSeenStandings({
      day: '2026-09-23',
      standings: [standing('ever', 1), { mode: 'trainee', difficulty: 'hard' }],
    })
    expect(read?.standings).toHaveLength(1)
  })
})

const row = (rank: number, userId: string, nickname: string): LeaderboardRow => ({
  rank,
  user_id: userId,
  nickname,
  best_score: 9000 - rank,
  hits: 40,
  achieved_at: '2026-09-23T09:00:00Z',
  avg_acc: 80,
  avg_spd: 60,
})

const lostGold: MedalLoss = {
  mode: 'speed',
  difficulty: 'hard',
  period: 'ever',
  had: 1,
  now: null,
}

describe('takerOf', () => {
  it('names whoever stands where the player used to', () => {
    const rows = [row(1, 'rival', 'Petr'), row(2, 'me', 'Donda')]
    expect(takerOf(rows, lostGold, 'me')).toEqual({ userId: 'rival', nickname: 'Petr' })
  })

  it('reads the rank off the row rather than its place in the list', () => {
    const rows = [row(2, 'second', 'Adela'), row(1, 'first', 'Petr')]
    expect(takerOf(rows, lostGold, 'me')?.nickname).toBe('Petr')
  })

  it('names nobody when the place is one the player still holds', () => {
    expect(takerOf([row(1, 'me', 'Donda')], lostGold, 'me')).toBeNull()
  })

  it('names nobody when the board does not reach the rank', () => {
    expect(takerOf([row(2, 'rival', 'Petr')], lostGold, 'me')).toBeNull()
  })

  it('names nobody when the board answered with nothing', () => {
    expect(takerOf([], lostGold, 'me')).toBeNull()
  })

  it('names nobody when the row has no nickname to give', () => {
    expect(takerOf([row(1, 'rival', '')], lostGold, 'me')).toBeNull()
  })
})
