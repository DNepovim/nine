import { describe, expect, it } from 'vitest'

import { hasBestScore } from './best-score'

describe('hasBestScore', () => {
  it('accepts a real score', () => {
    expect(hasBestScore(12480)).toBe(true)
  })

  it('rejects null — an empty board or a failed request', () => {
    expect(hasBestScore(null)).toBe(false)
  })

  it('rejects zero — the player has never scored on this board', () => {
    expect(hasBestScore(0)).toBe(false)
  })

  it('rejects a negative value rather than rendering a minus sign', () => {
    expect(hasBestScore(-5)).toBe(false)
  })
})
