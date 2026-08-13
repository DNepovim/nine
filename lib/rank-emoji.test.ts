import { describe, expect, it } from 'vitest'

import { rankEmoji, rankMedal } from './rank-emoji'

describe('rankEmoji', () => {
  it('gives the podium a medal', () => {
    expect(rankEmoji(1)).toBe('🥇')
    expect(rankEmoji(2)).toBe('🥈')
    expect(rankEmoji(3)).toBe('🥉')
  })

  it('marks the two places that finish last on a five-row board', () => {
    expect(rankEmoji(4)).toBe('🥔')
    expect(rankEmoji(5)).toBe('🐷')
  })

  it('falls back to nothing past the board, where a rank shows as its number', () => {
    expect(rankEmoji(6)).toBeNull()
    expect(rankEmoji(120)).toBeNull()
  })

  it('ignores ranks below first', () => {
    expect(rankEmoji(0)).toBeNull()
    expect(rankEmoji(-1)).toBeNull()
  })
})

describe('rankMedal', () => {
  it('gives the podium a medal', () => {
    expect(rankMedal(1)).toBe('🥇')
    expect(rankMedal(3)).toBe('🥉')
  })

  it('stops at the podium, unlike the board set', () => {
    expect(rankMedal(4)).toBeNull()
    expect(rankMedal(5)).toBeNull()
  })
})
