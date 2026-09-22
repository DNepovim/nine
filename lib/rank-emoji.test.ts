import { describe, expect, it } from 'vitest'

import { rankEmoji, rankMark, rankMedal } from './rank-emoji'

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

describe('rankMark', () => {
  it('calls the podium a medal', () => {
    expect(rankMark(1)).toBe('medal')
    expect(rankMark(3)).toBe('medal')
  })

  it('calls the last two places on the board creatures, so they can be drawn smaller', () => {
    expect(rankMark(4)).toBe('creature')
    expect(rankMark(5)).toBe('creature')
  })

  it('leaves everything off the board as a plain number', () => {
    expect(rankMark(6)).toBe('number')
    expect(rankMark(0)).toBe('number')
  })
})
