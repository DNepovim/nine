import { describe, expect, it } from 'vitest'

import { toMedals, type BoardStanding } from './medals'

const standing = (over: Partial<BoardStanding> = {}): BoardStanding => ({
  mode: 'accuracy',
  difficulty: 'easy',
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
    const medals = toMedals([
      standing({ rank: 3, difficulty: 'easy' }),
      standing({ rank: 1, difficulty: 'easy', mode: 'speed' }),
      standing({ rank: 2, difficulty: 'easy' }),
    ])
    expect(medals.map((m) => m.rank)).toEqual([1, 2, 3])
  })

  it('puts the harder board first within one medal', () => {
    const medals = toMedals([
      standing({ rank: 1, difficulty: 'easy' }),
      standing({ rank: 1, difficulty: 'extreme' }),
      standing({ rank: 1, difficulty: 'hard' }),
    ])
    expect(medals.map((m) => m.difficulty)).toEqual(['extreme', 'hard', 'easy'])
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
})
