import { describe, expect, it } from 'vitest'

import { nearestRecord } from './near-record'

const bars = { you: 800, today: 1000, week: 2000, ever: 5000 }

describe('nearestRecord', () => {
  it('is null while every gap is still wide open', () => {
    expect(nearestRecord(0, bars)).toBeNull()
  })

  it('names the bar once the score is within its margin', () => {
    // 5% of 1000 is 50, so 960 is close and 940 is not.
    expect(nearestRecord(960, bars)).toBe('today')
    expect(nearestRecord(940, { ...bars, week: null, ever: null })).toBeNull()
  })

  it('is null once the bar is actually cleared — that is a crossing, not a tease', () => {
    expect(nearestRecord(1000, bars)).toBeNull()
    expect(nearestRecord(1200, bars)).toBeNull()
  })

  it('picks the tightest gap among several close bars', () => {
    // Both are within their own margin at once — today needs 20, week needs 100 (5%
    // of 2000) — and today is the tighter claim despite week being the bigger board.
    expect(nearestRecord(1900, { you: null, today: 1920, week: 2000, ever: null })).toBe(
      'today',
    )
  })

  it('favours the bigger board on a tie', () => {
    expect(nearestRecord(950, { you: 1000, today: 1000, week: 1000, ever: 1000 })).toBe(
      'ever',
    )
  })

  it('ignores a bar that is not there yet to chase', () => {
    expect(nearestRecord(0, { you: 0, today: null, week: 0, ever: null })).toBeNull()
  })

  it('never teases past the bar, however small the score', () => {
    expect(nearestRecord(-5, bars)).toBeNull()
  })
})
