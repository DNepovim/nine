import { describe, expect, it } from 'vitest'

import { boardOf } from './board-events'

describe('boardOf', () => {
  it('names the board an insert or update belongs to', () => {
    expect(boardOf({ new: { mode: 'speed', difficulty: 'hard' } })).toEqual({
      mode: 'speed',
      difficulty: 'hard',
    })
  })

  it('reads a delete from old, where the row is', () => {
    expect(boardOf({ old: { mode: 'accuracy', difficulty: 'extreme' } })).toEqual({
      mode: 'accuracy',
      difficulty: 'extreme',
    })
  })

  it('prefers new over old when both are present', () => {
    expect(
      boardOf({
        new: { mode: 'speed', difficulty: 'hard' },
        old: { mode: 'speed', difficulty: 'easy' },
      }),
    ).toEqual({ mode: 'speed', difficulty: 'hard' })
  })

  it('cannot attribute an event carrying no row', () => {
    expect(boardOf({})).toBeNull()
  })

  it('cannot attribute a row missing either column', () => {
    expect(boardOf({ new: {} })).toBeNull()
    expect(boardOf({ new: { mode: 'speed' } })).toBeNull()
    expect(boardOf({ new: { difficulty: 'hard' } })).toBeNull()
  })

  it('cannot attribute a board this build does not know', () => {
    // Rather than inventing a board of its own, which would then match nothing.
    expect(boardOf({ new: { mode: 'speed', difficulty: 'nightmare' } })).toBeNull()
    expect(boardOf({ new: { mode: 'trainee', difficulty: 'hard' } })).toBeNull()
  })
})
