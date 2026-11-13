import { describe, expect, it } from 'vitest'

import { against, arrow, rungOf } from './stat-figures'

describe('arrow', () => {
  it('points the way the figure moved, and holds still when it did not', () => {
    expect(arrow(5, 3)).toBe('▲')
    expect(arrow(3, 5)).toBe('▼')
    expect(arrow(4, 4)).toBe('·')
  })
})

describe('against', () => {
  it('writes the move and what it moved from', () => {
    expect(against(12, 9, 'was')).toBe('▲ was 9')
  })
})

describe('rungOf', () => {
  it('narrows the three rungs', () => {
    expect(rungOf('easy')).toBe('easy')
    expect(rungOf('hard')).toBe('hard')
    expect(rungOf('extreme')).toBe('extreme')
  })

  it('is null for anything else, the coalesced unknown included', () => {
    expect(rungOf('unknown')).toBeNull()
    expect(rungOf('medium')).toBeNull()
  })
})
