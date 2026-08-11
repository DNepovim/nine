import { describe, expect, it } from 'vitest'

import { boardFilter, isBoardEvent } from './board-events'

describe('boardFilter', () => {
  it('filters on one column only', () => {
    // Two conditions joined with & silently match nothing in postgres_changes, so this
    // must stay a single expression however tempting it is to narrow it further.
    expect(boardFilter('speed')).toBe('mode=eq.speed')
    expect(boardFilter('speed')).not.toContain('&')
  })
})

describe('isBoardEvent', () => {
  it('accepts an insert or update for the watched difficulty', () => {
    expect(isBoardEvent({ new: { difficulty: 'hard' } }, 'hard')).toBe(true)
  })

  it('rejects another difficulty on the same mode', () => {
    expect(isBoardEvent({ new: { difficulty: 'easy' } }, 'hard')).toBe(false)
  })

  it('reads a delete from old, where the row is', () => {
    expect(isBoardEvent({ old: { difficulty: 'extreme' } }, 'extreme')).toBe(true)
  })

  it('prefers new over old when both are present', () => {
    expect(
      isBoardEvent({ new: { difficulty: 'hard' }, old: { difficulty: 'easy' } }, 'hard'),
    ).toBe(true)
  })

  it('treats an unattributable event as a miss', () => {
    expect(isBoardEvent({}, 'hard')).toBe(false)
    expect(isBoardEvent({ new: {} }, 'hard')).toBe(false)
  })
})
