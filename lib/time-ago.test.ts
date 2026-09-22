import { describe, expect, it } from 'vitest'

import { timeAgo } from './time-ago'

const NOW = Date.parse('2026-08-13T12:00:00.000Z')
const ago = (ms: number) => new Date(NOW - ms).toISOString()

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('timeAgo', () => {
  it('says now under a minute', () => {
    expect(timeAgo(ago(0), NOW)).toBe('now')
    expect(timeAgo(ago(59_000), NOW)).toBe('now')
  })

  it('counts minutes, hours and days', () => {
    expect(timeAgo(ago(MINUTE), NOW)).toBe('1 min ago')
    expect(timeAgo(ago(59 * MINUTE), NOW)).toBe('59 min ago')
    expect(timeAgo(ago(2 * HOUR), NOW)).toBe('2 hrs ago')
    expect(timeAgo(ago(23 * HOUR), NOW)).toBe('23 hrs ago')
    expect(timeAgo(ago(3 * DAY), NOW)).toBe('3 days ago')
  })

  it('says a single one in the singular', () => {
    // `1 hrs ago` beside a score reads as a bug rather than as a time.
    expect(timeAgo(ago(HOUR), NOW)).toBe('1 hr ago')
    expect(timeAgo(ago(DAY), NOW)).toBe('1 day ago')
    expect(timeAgo(ago(8 * DAY), NOW)).toBe('1 wk ago')
    expect(timeAgo(ago(40 * DAY), NOW)).toBe('1 mth ago')
  })

  it('rounds down to the unit rather than up', () => {
    expect(timeAgo(ago(HOUR + 59 * MINUTE), NOW)).toBe('1 hr ago')
  })

  it('keeps minutes and months apart on sight', () => {
    // The whole point of spelling the unit out: `5M` and `2MO` were one letter apart
    // at 7px, and the letter was the one that decided between a coffee break and a
    // season.
    expect(timeAgo(ago(5 * MINUTE), NOW)).toBe('5 min ago')
    expect(timeAgo(ago(60 * DAY), NOW)).toBe('2 mths ago')
  })

  it('reaches weeks and years', () => {
    expect(timeAgo(ago(14 * DAY), NOW)).toBe('2 wks ago')
    expect(timeAgo(ago(400 * DAY), NOW)).toBe('1 yr ago')
    expect(timeAgo(ago(800 * DAY), NOW)).toBe('2 yrs ago')
  })

  it('treats a future timestamp as now, so clock skew cannot read as ahead', () => {
    expect(timeAgo(ago(-5 * MINUTE), NOW)).toBe('now')
  })

  it('is null for a timestamp it cannot read', () => {
    expect(timeAgo('not a date', NOW)).toBeNull()
  })
})
