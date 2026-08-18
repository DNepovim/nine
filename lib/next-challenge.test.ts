import { describe, expect, it } from 'vitest'

import {
  earnedChallenge,
  easierChallenge,
  nextChallenge,
  runChallenge,
  struggledRun,
} from './next-challenge'

describe('earnedChallenge', () => {
  it('offers the next rung when a tenth of the hits landed on a streak', () => {
    expect(earnedChallenge(20, 2)).toBe(true)
  })

  it('holds it back when the streaks were thinner than that', () => {
    expect(earnedChallenge(20, 1)).toBe(false)
  })

  it('holds it back after a run with no streak at all', () => {
    expect(earnedChallenge(14, 0)).toBe(false)
  })

  it('holds it back after a run with no hits at all', () => {
    expect(earnedChallenge(0, 0)).toBe(false)
  })

  it('offers it on a short run that was all streak', () => {
    expect(earnedChallenge(3, 3)).toBe(true)
  })

  it('rounds in the player’s favour — 9 hits and 1 strike clears the bar', () => {
    expect(earnedChallenge(9, 1)).toBe(true)
  })
})

describe('nextChallenge', () => {
  it('climbs to the next difficulty in the same mode', () => {
    expect(nextChallenge('accuracy', 'easy')).toEqual({
      mode: 'accuracy',
      difficulty: 'hard',
      label: 'STEP UP TO HARD',
    })
  })

  it('climbs from hard to extreme', () => {
    expect(nextChallenge('speed', 'hard')).toEqual({
      mode: 'speed',
      difficulty: 'extreme',
      label: 'STEP UP TO EXTREME',
    })
  })

  it('offers the other mode at extreme, where there is no harder difficulty', () => {
    expect(nextChallenge('accuracy', 'extreme')).toEqual({
      mode: 'speed',
      difficulty: 'extreme',
      label: 'TRY SPEED',
    })
  })

  it('points the two scored modes at each other so extreme can bounce between them', () => {
    expect(nextChallenge('speed', 'extreme')).toEqual({
      mode: 'accuracy',
      difficulty: 'extreme',
      label: 'TRY ACCURACY',
    })
  })

  it('sends an extreme trainee to accuracy — practice steps up into a scored mode', () => {
    expect(nextChallenge('trainee', 'extreme')).toEqual({
      mode: 'accuracy',
      difficulty: 'extreme',
      label: 'TRY ACCURACY',
    })
  })
})

describe('struggledRun', () => {
  it('offers it after a hitless run', () => {
    expect(struggledRun(0)).toBe(true)
  })

  it('offers it under the struggle bar', () => {
    expect(struggledRun(2)).toBe(true)
  })

  it('holds it back once hits clear the bar', () => {
    expect(struggledRun(3)).toBe(false)
    expect(struggledRun(20)).toBe(false)
  })
})

describe('easierChallenge', () => {
  it('drops to the previous difficulty in the same mode', () => {
    expect(easierChallenge('speed', 'extreme')).toEqual({
      mode: 'speed',
      difficulty: 'hard',
      label: 'STEP DOWN TO HARD',
    })
  })

  it('drops from hard to easy', () => {
    expect(easierChallenge('accuracy', 'hard')).toEqual({
      mode: 'accuracy',
      difficulty: 'easy',
      label: 'STEP DOWN TO EASY',
    })
  })

  it('offers Trainee once already on Easy, where there is no easier difficulty', () => {
    expect(easierChallenge('accuracy', 'easy')).toEqual({
      mode: 'trainee',
      difficulty: 'easy',
      label: 'TRY TRAINEE',
    })
    expect(easierChallenge('speed', 'easy')).toEqual({
      mode: 'trainee',
      difficulty: 'easy',
      label: 'TRY TRAINEE',
    })
  })
})

describe('runChallenge', () => {
  it('is null for an ordinary run — neither earned nor struggled', () => {
    expect(runChallenge('accuracy', 'hard', 10, 0)).toBeNull()
  })

  it('offers the dare for a run that earned it', () => {
    expect(runChallenge('accuracy', 'easy', 20, 2)).toEqual(
      nextChallenge('accuracy', 'easy'),
    )
  })

  it('offers to ease off for a run that struggled', () => {
    expect(runChallenge('speed', 'extreme', 1, 0)).toEqual(
      easierChallenge('speed', 'extreme'),
    )
  })

  it('prefers the dare when a short run is both earned and struggled at once', () => {
    // Two hits, both optimal: earnedChallenge and struggledRun both pass here.
    expect(earnedChallenge(2, 1)).toBe(true)
    expect(struggledRun(2)).toBe(true)
    expect(runChallenge('accuracy', 'easy', 2, 1)).toEqual(
      nextChallenge('accuracy', 'easy'),
    )
  })
})
