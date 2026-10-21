import { describe, expect, it } from 'vitest'

import { gameOverTitle } from './game-over-title'

// Roll 0 always draws the first line of a tier's pool, so these assert the tier.
const run = (over: Partial<Parameters<typeof gameOverTitle>[0]> = {}, roll = 0) =>
  gameOverTitle(
    {
      screen: 'plain',
      mode: 'accuracy',
      medals: [],
      podium: false,
      personalBest: false,
      difficulty: 'easy',
      score: 800,
      hits: 10,
      strikes: 0,
      ...over,
    },
    roll,
  )

describe('gameOverTitle', () => {
  it('calls a board record gold', () => {
    expect(run({ medals: ['today'] })).toEqual(['PURE', 'GOLD'])
    expect(run({ medals: ['week'] })).toEqual(['PURE', 'GOLD'])
  })

  it('gives the all-time record words of its own', () => {
    // The one record that cannot be taken again tomorrow does not share the day's.
    expect(run({ medals: ['ever'], screen: 'wash' })).toEqual(['BEST', 'EVER'])
    expect(run({ medals: ['ever', 'week', 'today'] })).toEqual(['BEST', 'EVER'])
  })

  it('crowns a reign and gives each mode’s Extreme record its own bird', () => {
    expect(run({ medals: ['ever'], screen: 'crown' })).toEqual(['BEST', 'EVER'])
    expect(run({ medals: ['ever'], screen: 'bird', mode: 'accuracy' })).toEqual([
      'TRUE',
      'SHOT',
    ])
    expect(run({ medals: ['ever'], screen: 'bird', mode: 'speed' })).toEqual([
      'FAST',
      'WING',
    ])
  })

  it('takes the board record over the personal best behind it', () => {
    // Taking a board almost always beats your own best on the way, and the board is
    // the bigger claim.
    expect(run({ medals: ['today'], personalBest: true })).toEqual(['PURE', 'GOLD'])
  })

  it('names a personal best when no board fell', () => {
    expect(run({ personalBest: true })).toEqual(['YOUR', 'BEST'])
  })

  it('calls a podium finish a medal even without the top spot', () => {
    expect(run({ podium: true })).toEqual(['MADE', 'RANK'])
  })

  it('takes the outright board record over a lesser podium finish', () => {
    expect(run({ podium: true, medals: ['today'] })).toEqual(['PURE', 'GOLD'])
  })

  it('takes a podium finish over a cold score or a personal best', () => {
    expect(run({ podium: true, score: 20 })).toEqual(['MADE', 'RANK'])
    expect(run({ podium: true, personalBest: true })).toEqual(['MADE', 'RANK'])
  })

  it('credits a run with streaks in it', () => {
    expect(run({ hits: 20, strikes: 2 })).toEqual(['WELL', 'DONE'])
  })

  it('falls back to a plain sign-off', () => {
    expect(run({ hits: 20, strikes: 1 })).toEqual(['GOOD', 'GAME'])
  })

  it('calls a run that never got going cold', () => {
    expect(run({ score: 40, hits: 1 })).toEqual(['COLD', 'DIAL'])
  })

  it('drops the bar as the clock tightens', () => {
    // 100 is a cold run on Easy and an ordinary one on Extreme.
    expect(run({ difficulty: 'easy', score: 100 })).toEqual(['COLD', 'DIAL'])
    expect(run({ difficulty: 'hard', score: 100 })).toEqual(['COLD', 'DIAL'])
    expect(run({ difficulty: 'extreme', score: 100 })).toEqual(['GOOD', 'GAME'])
  })

  it('lets a record outrank a cold score', () => {
    // A first score on an empty board can take it while barely scoring at all.
    expect(run({ score: 20, medals: ['today'] })).toEqual(['PURE', 'GOLD'])
    expect(run({ score: 20, personalBest: true })).toEqual(['YOUR', 'BEST'])
  })

  it('calls a cold run cold even when its few hits were streaks', () => {
    expect(run({ score: 40, hits: 2, strikes: 2 })).toEqual(['COLD', 'DIAL'])
  })

  it('rotates through the tier’s three lines with the roll', () => {
    const cold = [0, 0.34, 0.67].map((roll) => run({ score: 40 }, roll).join(' '))
    expect(cold).toEqual(['COLD DIAL', 'NEXT TIME', 'HARD LUCK'])
  })

  it('stays inside the pool for the edges of the roll', () => {
    // Math.random() never returns 1, but nothing in the type says so.
    expect(run({ score: 40 }, 0.999)).toEqual(['HARD', 'LUCK'])
    expect(run({ score: 40 }, 1)).toEqual(['HARD', 'LUCK'])
    expect(run({ score: 40 }, -1)).toEqual(['COLD', 'DIAL'])
  })

  it('is always two four-letter words, so the animation shape holds', () => {
    // Every line of every tier, not just the first of each: the animation indexes
    // letters into a 4×2 grid, so a five-letter word would fall off the ramp.
    const tiers = [
      { medals: ['ever'] as const },
      { podium: true },
      { personalBest: true },
      { score: 10 },
      { hits: 20, strikes: 2 },
      {},
    ]
    for (const tier of tiers) {
      for (const roll of [0, 0.34, 0.67]) {
        const [first, second] = run(tier, roll)
        expect([first.length, second.length]).toEqual([4, 4])
      }
    }
  })
})

// A **session**'s window shutting under a live run. The one claim that is about why the
// screen is up rather than what the run was worth, which is why it is answered first.
describe('a window that shut under the run', () => {
  it('names the window rather than the run', () => {
    expect(run({ windowShut: true })).toEqual(['TIME', 'GONE'])
  })

  it('beats every other claim, including the crown', () => {
    // A run that took both Extreme all-time boards on its last hit still ended because
    // the contest closed, and that is the thing the player needs told first.
    expect(run({ windowShut: true, screen: 'crown', medals: ['ever'] })).toEqual([
      'TIME',
      'GONE',
    ])
    expect(run({ windowShut: true, sessionRank: 1 })).toEqual(['TIME', 'GONE'])
  })

  it('does not let a cold run be called cold on the way out', () => {
    // Without the tier answering first this would be the `cold` pool, which comments on
    // how the run was going — and the run was stopped, not lost.
    expect(run({ windowShut: true, score: 0, hits: 0 })).toEqual(['TIME', 'GONE'])
  })

  it('still lets a challenge name its own words for it', () => {
    expect(
      gameOverTitle(
        {
          screen: 'plain',
          mode: 'accuracy',
          medals: [],
          podium: false,
          personalBest: false,
          difficulty: 'easy',
          score: 800,
          hits: 10,
          strikes: 0,
          windowShut: true,
        },
        0,
        { expired: [['GATE', 'SHUT']] },
      ),
    ).toEqual(['GATE', 'SHUT'])
  })

  it('is absent on every ordinary run', () => {
    expect(run({ medals: ['ever'] })).not.toEqual(['TIME', 'GONE'])
  })
})
