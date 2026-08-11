import { describe, expect, it } from 'vitest'

import { displayName, rivalChange, type Leaders } from './announcements'

const ME = 'me-uuid'
const RIVAL = 'rival-uuid'

const leader = (score: number, userId = RIVAL, nickname: string | null = 'ace') => ({
  score,
  userId,
  nickname,
})

const board = (over: Partial<Leaders> = {}): Leaders => ({
  today: leader(100),
  week: leader(200),
  ever: leader(300),
  ...over,
})

describe('rivalChange', () => {
  it('is null when nothing moved', () => {
    expect(rivalChange(board(), board(), ME)).toBeNull()
  })

  it('announces a rival raising a board record', () => {
    const after = board({ today: leader(150) })
    expect(rivalChange(board(), after, ME)?.id).toBe('todayRaised')
  })

  it('announces losing a record you held', () => {
    const before = board({ week: leader(200, ME, 'you') })
    const after = board({ week: leader(250) })
    expect(rivalChange(before, after, ME)?.id).toBe('weekLost')
  })

  it('prefers a record taken from you over one merely raised', () => {
    // The rival passes both, but only the week was yours.
    const before = board({ week: leader(200, ME, 'you') })
    const after = board({ today: leader(150), week: leader(250) })
    expect(rivalChange(before, after, ME)?.id).toBe('weekLost')
  })

  it('prefers the biggest period among equals', () => {
    const after = board({ today: leader(150), ever: leader(350) })
    expect(rivalChange(board(), after, ME)?.id).toBe('everRaised')
  })

  it('says nothing about your own new record — the run announces that', () => {
    const after = board({ ever: leader(400, ME, 'you') })
    expect(rivalChange(board(), after, ME)).toBeNull()
  })

  it('says nothing without a baseline', () => {
    const empty: Leaders = { today: null, week: null, ever: null }
    expect(rivalChange(empty, board(), ME)).toBeNull()
  })

  it('ignores a score that did not actually beat the record', () => {
    const after = board({ today: leader(100, 'other-uuid') })
    expect(rivalChange(board(), after, ME)).toBeNull()
  })

  it('carries the rival name, upper-cased', () => {
    const after = board({ today: leader(150, RIVAL, 'bolt') })
    expect(rivalChange(board(), after, ME)?.name).toBe('BOLT')
  })

  it('still works for a signed-out player — nothing can be theirs to lose', () => {
    const before = board({ week: leader(200, ME, 'you') })
    const after = board({ week: leader(250) })
    expect(rivalChange(before, after, null)?.id).toBe('weekRaised')
  })
})

describe('displayName', () => {
  it('upper-cases a nickname', () => {
    expect(displayName('ace')).toBe('ACE')
  })

  it('falls back when a profile has no nickname', () => {
    expect(displayName(null)).toBe('SOMEONE')
    expect(displayName('   ')).toBe('SOMEONE')
  })

  it('keeps a name at the limit whole', () => {
    expect(displayName('abcdefghij')).toBe('ABCDEFGHIJ')
  })

  it('truncates a longer name with an ellipsis', () => {
    // Nicknames are capped at 16 in the UI and unconstrained in the database.
    expect(displayName('abcdefghijklmnop')).toBe('ABCDEFGHI…')
  })
})
