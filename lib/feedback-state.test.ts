import { describe, expect, it } from 'vitest'

import { gameSnapshot, MAX_STATE_LENGTH } from './feedback-state'

describe('gameSnapshot', () => {
  it('carries the state and the whole context', () => {
    expect(gameSnapshot('paused', { score: 420, grid: [[1, 2, 3]], lives: 2 })).toEqual({
      state: 'paused',
      context: { score: 420, grid: [[1, 2, 3]], lives: 2 },
    })
  })

  it('names an infinite number rather than writing it as null', () => {
    // Trainee's lives are Infinity, and a snapshot saying `"lives": null` would read as
    // none left — the opposite of what it means.
    expect(gameSnapshot('paused', { lives: Number.POSITIVE_INFINITY })).toEqual({
      state: 'paused',
      context: { lives: 'Infinity' },
    })
  })

  it('attaches nothing rather than a snapshot past the ceiling', () => {
    const huge = { targets: Array.from({ length: MAX_STATE_LENGTH }, (_, i) => i) }
    expect(gameSnapshot('paused', huge)).toBeNull()
  })

  it('attaches nothing rather than throwing on a context that cannot be written', () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(gameSnapshot('paused', cyclic)).toBeNull()
  })
})
