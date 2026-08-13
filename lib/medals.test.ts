import { describe, expect, it } from 'vitest'

import { toMedals, type BoardStanding } from './medals'

const standing = (over: Partial<BoardStanding> = {}): BoardStanding => ({
  mode: 'accuracy',
  difficulty: 'easy',
  period: 'ever',
  rank: 1,
  score: 100,
  ...over,
})

describe('toMedals', () => {
  it('keeps the podium', () => {
    const medals = toMedals([
      standing({ rank: 1, difficulty: 'easy' }),
      standing({ rank: 3, difficulty: 'hard' }),
    ])
    expect(medals.map((m) => m.rank)).toEqual([1, 3])
  })

  it('drops anything off the podium', () => {
    expect(toMedals([standing({ rank: 4 })])).toEqual([])
    expect(toMedals([standing({ rank: 57 })])).toEqual([])
  })

  it('drops a rank that no score stands behind', () => {
    // What my_rank returns on an empty board for someone who has never played.
    expect(toMedals([standing({ rank: 1, score: 0 })])).toEqual([])
  })

  it('orders gold before silver before bronze', () => {
    // One board carries one rank per period, so these have to be three boards.
    const medals = toMedals([
      standing({ rank: 3, difficulty: 'easy' }),
      standing({ rank: 1, difficulty: 'easy', mode: 'speed' }),
      standing({ rank: 2, difficulty: 'hard' }),
    ])
    expect(medals.map((m) => m.rank)).toEqual([1, 2, 3])
  })

  it('puts the harder board first within one medal', () => {
    // Across modes: one mode keeps a medal only on its hardest board.
    const medals = toMedals([
      standing({ rank: 1, difficulty: 'hard', mode: 'speed' }),
      standing({ rank: 1, difficulty: 'extreme', mode: 'accuracy' }),
    ])
    expect(medals.map((m) => m.difficulty)).toEqual(['extreme', 'hard'])
  })

  it('breaks a remaining tie by mode order', () => {
    const medals = toMedals([
      standing({ rank: 1, difficulty: 'hard', mode: 'speed' }),
      standing({ rank: 1, difficulty: 'hard', mode: 'accuracy' }),
    ])
    expect(medals.map((m) => m.mode)).toEqual(['accuracy', 'speed'])
  })

  it('has nothing to show for a player who has never medalled', () => {
    expect(toMedals([])).toEqual([])
  })

  it('shows a board once, at the longest-standing period it holds', () => {
    // Holding a board all time normally means holding it this week and today too.
    const medals = toMedals([
      standing({ period: 'today', rank: 1 }),
      standing({ period: 'week', rank: 1 }),
      standing({ period: 'ever', rank: 1 }),
    ])
    expect(medals).toEqual([
      { mode: 'accuracy', difficulty: 'easy', period: 'ever', rank: 1 },
    ])
  })

  it('prefers the better rank over the longer period on one board', () => {
    const medals = toMedals([
      standing({ period: 'ever', rank: 3 }),
      standing({ period: 'today', rank: 1 }),
    ])
    expect(medals).toEqual([
      { mode: 'accuracy', difficulty: 'easy', period: 'today', rank: 1 },
    ])
  })

  it('keeps the same period on different boards', () => {
    const medals = toMedals([
      standing({ period: 'today', difficulty: 'easy', rank: 2 }),
      standing({ period: 'today', difficulty: 'hard', rank: 1 }),
    ])
    expect(medals.map((m) => [m.difficulty, m.period])).toEqual([
      ['hard', 'today'],
      ['easy', 'today'],
    ])
  })

  it('shows one medal in one mode only on the hardest board that earned it', () => {
    const medals = toMedals([
      standing({ rank: 1, difficulty: 'easy' }),
      standing({ rank: 1, difficulty: 'hard' }),
    ])
    expect(medals).toEqual([
      { mode: 'accuracy', difficulty: 'hard', period: 'ever', rank: 1 },
    ])
  })

  it('keeps different medals in one mode side by side', () => {
    const medals = toMedals([
      standing({ rank: 2, difficulty: 'easy' }),
      standing({ rank: 1, difficulty: 'hard' }),
    ])
    expect(medals.map((m) => [m.rank, m.difficulty])).toEqual([
      [1, 'hard'],
      [2, 'easy'],
    ])
  })

  it('keeps the same medal in different modes', () => {
    // The collapse is per mode, so gold in both modes is two medals, not one.
    const medals = toMedals([
      standing({ rank: 1, difficulty: 'hard', mode: 'accuracy' }),
      standing({ rank: 1, difficulty: 'hard', mode: 'speed' }),
    ])
    expect(medals.map((m) => m.mode)).toEqual(['accuracy', 'speed'])
  })

  it('orders all-time ahead of the day on boards the medal and difficulty tie', () => {
    const medals = toMedals([
      standing({ rank: 1, difficulty: 'hard', mode: 'accuracy', period: 'today' }),
      standing({ rank: 1, difficulty: 'hard', mode: 'speed', period: 'ever' }),
    ])
    expect(medals.map((m) => [m.mode, m.period])).toEqual([
      ['speed', 'ever'],
      ['accuracy', 'today'],
    ])
  })
})
