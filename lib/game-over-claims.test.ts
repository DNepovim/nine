import { describe, expect, it } from 'vitest'

import { gameOverTitle } from './game-over-title'

// A run that earned nothing, which is the tier every challenge run used to land on.
const PLAIN = {
  screen: 'plain' as const,
  mode: 'accuracy' as const,
  medals: [],
  podium: false,
  personalBest: false,
  difficulty: 'hard' as const,
  score: 2000,
  hits: 20,
  strikes: 0,
}

const CLAIMS = {
  board: [['FOUR', 'KEYS']],
  cold: [['COLD', 'KEYS']],
} as const

describe('a session standing reaches the title', () => {
  it('taking the session is claimed as loudly as taking a board', () => {
    // Without this a challenge could only ever be told it was cold, strong or played:
    // every board fact is empty for a mode that keeps no board.
    expect(gameOverTitle({ ...PLAIN, sessionRank: 1 }, 0)).toEqual(['PURE', 'GOLD'])
  })

  it('second and third are a podium rather than a win', () => {
    expect(gameOverTitle({ ...PLAIN, sessionRank: 2 }, 0)).toEqual(['MADE', 'RANK'])
    expect(gameOverTitle({ ...PLAIN, sessionRank: 3 }, 0)).toEqual(['MADE', 'RANK'])
  })

  it('outranks a cold score, so the screen never argues with itself', () => {
    // A run can take a thin session with a low score. Being told it won and that it was
    // cold in the same breath is the thing this ordering prevents.
    const cold = { ...PLAIN, score: 1 }
    expect(gameOverTitle({ ...cold, sessionRank: null }, 0)).toEqual(['COLD', 'DIAL'])
    expect(gameOverTitle({ ...cold, sessionRank: 1 }, 0)).toEqual(['PURE', 'GOLD'])
  })

  it('changes nothing for a run with no session', () => {
    expect(gameOverTitle(PLAIN, 0)).toEqual(
      gameOverTitle({ ...PLAIN, sessionRank: null }, 0),
    )
  })
})

describe('a mode’s own claims', () => {
  it('replace the app’s words for the tiers it names', () => {
    expect(gameOverTitle({ ...PLAIN, sessionRank: 1 }, 0, CLAIMS)).toEqual([
      'FOUR',
      'KEYS',
    ])
  })

  it('fall through to the app’s pool for the tiers it does not', () => {
    // `medal` is unnamed above, so second place still says what it always said.
    expect(gameOverTitle({ ...PLAIN, sessionRank: 2 }, 0, CLAIMS)).toEqual([
      'MADE',
      'RANK',
    ])
  })

  it('are ignored where the mode names none at all', () => {
    // Both shapes a mode with no words of its own arrives in: the field absent, and the
    // field present but empty.
    expect(gameOverTitle({ ...PLAIN, sessionRank: 1 }, 0)).toEqual(['PURE', 'GOLD'])
    expect(gameOverTitle({ ...PLAIN, sessionRank: 1 }, 0, {})).toEqual(['PURE', 'GOLD'])
  })

  it('survive an empty pool rather than drawing nothing', () => {
    // A spec that named a tier and left its list empty would otherwise index into
    // nothing and put `undefined` on the screen.
    expect(gameOverTitle({ ...PLAIN, sessionRank: 1 }, 0, { board: [] })).toEqual([
      'PURE',
      'GOLD',
    ])
  })

  it('still roll across their own pool', () => {
    const pool = {
      cold: [
        ['ONE', 'A'],
        ['TWO', 'B'],
        ['THREE', 'C'],
      ],
    } as const
    const cold = { ...PLAIN, score: 1, sessionRank: null }
    expect(gameOverTitle(cold, 0, pool)).toEqual(['ONE', 'A'])
    expect(gameOverTitle(cold, 0.5, pool)).toEqual(['TWO', 'B'])
    expect(gameOverTitle(cold, 0.99, pool)).toEqual(['THREE', 'C'])
  })
})
