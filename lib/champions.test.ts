import { describe, expect, it } from 'vitest'

import { championMark, NO_CHAMPIONS, recordScreen, type Champions } from './champions'

const ME = 'me'
const THEM = 'them'

const holding = (over: Partial<Champions> = {}): Champions => ({
  ...NO_CHAMPIONS,
  ...over,
})

describe('championMark', () => {
  it('crowns a player holding both Extreme boards', () => {
    expect(championMark(ME, holding({ accuracy: ME, speed: ME }))).toBe('👑')
  })

  it('gives each mode its own bird', () => {
    expect(championMark(ME, holding({ accuracy: ME }))).toBe('🦉')
    expect(championMark(ME, holding({ speed: ME }))).toBe('🦅')
  })

  it('marks nobody else', () => {
    expect(championMark(ME, holding({ accuracy: THEM, speed: THEM }))).toBeNull()
    expect(championMark(ME, NO_CHAMPIONS)).toBeNull()
  })

  it('marks nothing without a player to ask about', () => {
    // A signed-out device must not wear someone else's crown.
    expect(championMark(null, holding({ accuracy: null }))).toBeNull()
  })
})

describe('recordScreen', () => {
  const run = (over: Partial<Parameters<typeof recordScreen>[0]> = {}) =>
    recordScreen({
      record: 'ever',
      mode: 'accuracy',
      difficulty: 'extreme',
      userId: ME,
      champions: NO_CHAMPIONS,
      ...over,
    })

  it('crowns an Extreme all-time record when the other mode is already held', () => {
    expect(run({ champions: holding({ speed: ME }) })).toBe('crown')
  })

  it('gives the bird when the other mode belongs to someone else', () => {
    expect(run({ champions: holding({ speed: THEM }) })).toBe('bird')
    expect(run()).toBe('bird')
  })

  it('ignores the player’s own mode when deciding — the run just took it', () => {
    expect(run({ champions: holding({ accuracy: ME }) })).toBe('bird')
  })

  it('washes an all-time record on an easier board', () => {
    expect(run({ difficulty: 'hard' })).toBe('wash')
    expect(run({ difficulty: 'easy', champions: holding({ speed: ME }) })).toBe('wash')
  })

  it('leaves the day and the week on the plain screen', () => {
    expect(run({ record: 'week' })).toBe('plain')
    expect(run({ record: 'today' })).toBe('plain')
    expect(run({ record: null })).toBe('plain')
  })
})
