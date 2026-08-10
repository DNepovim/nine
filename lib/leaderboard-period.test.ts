import { describe, expect, it } from 'vitest'

import { dayInPrague, qualifiesForTab, tabSince, weekStart } from './leaderboard-period'

describe('dayInPrague', () => {
  // Fixed instants, so these assert the same thing whatever the runner's timezone.
  it('is still yesterday just before Prague midnight in summer', () => {
    // 21:30 UTC = 23:30 CEST.
    expect(dayInPrague(new Date('2026-08-10T21:30:00Z'))).toBe('2026-08-10')
  })

  it('has rolled over after Prague midnight in summer', () => {
    // 22:30 UTC = 00:30 CEST the next day — two hours ahead of UTC's rollover.
    expect(dayInPrague(new Date('2026-08-10T22:30:00Z'))).toBe('2026-08-11')
  })

  it('rolls over an hour later in winter', () => {
    // 22:30 UTC = 23:30 CET, still the same day; 23:30 UTC = 00:30 CET the next.
    expect(dayInPrague(new Date('2026-01-15T22:30:00Z'))).toBe('2026-01-15')
    expect(dayInPrague(new Date('2026-01-15T23:30:00Z'))).toBe('2026-01-16')
  })

  it('handles the spring forward', () => {
    // DST starts 01:00 UTC on Sunday 2026-03-29; the date is the same either side.
    expect(dayInPrague(new Date('2026-03-29T00:30:00Z'))).toBe('2026-03-29')
    expect(dayInPrague(new Date('2026-03-29T01:30:00Z'))).toBe('2026-03-29')
  })

  it('handles the autumn fall back', () => {
    // DST ends 01:00 UTC on Sunday 2026-10-25.
    expect(dayInPrague(new Date('2026-10-25T00:30:00Z'))).toBe('2026-10-25')
    expect(dayInPrague(new Date('2026-10-25T01:30:00Z'))).toBe('2026-10-25')
  })

  it('crosses new year on the Prague clock, not UTC', () => {
    // 23:30 UTC on 31 December is already 00:30 on 1 January in Prague.
    expect(dayInPrague(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01')
  })
})

describe('weekStart', () => {
  it('returns the Monday of a midweek day', () => {
    // 2026-08-12 is a Wednesday.
    expect(weekStart('2026-08-12')).toBe('2026-08-10')
  })

  it('returns the day itself on a Monday', () => {
    expect(weekStart('2026-08-10')).toBe('2026-08-10')
  })

  it('treats Sunday as the end of the week that began six days earlier', () => {
    // 2026-08-09 is a Sunday, so its week started Monday 2026-08-03 — not the
    // Monday that follows it.
    expect(weekStart('2026-08-09')).toBe('2026-08-03')
  })

  it('crosses a month boundary', () => {
    // Sunday 2026-03-01 belongs to the week starting Monday 2026-02-23.
    expect(weekStart('2026-03-01')).toBe('2026-02-23')
  })

  it('crosses a year boundary', () => {
    // Thursday 2026-01-01 belongs to the week starting Monday 2025-12-29.
    expect(weekStart('2026-01-01')).toBe('2025-12-29')
  })
})

describe('tabSince', () => {
  it('bounds today at today', () => {
    expect(tabSince('today', '2026-08-12')).toBe('2026-08-12')
  })

  it('bounds the week at the current Monday', () => {
    expect(tabSince('week', '2026-08-12')).toBe('2026-08-10')
  })

  it('has no bound for all time', () => {
    expect(tabSince('forever', '2026-08-12')).toBeNull()
  })
})

describe('qualifiesForTab', () => {
  // Wednesday, so its week runs Monday 2026-08-10 to Sunday 2026-08-16.
  const WEDNESDAY = '2026-08-12'

  it("accepts today's score under today", () => {
    expect(qualifiesForTab(WEDNESDAY, 'today', WEDNESDAY)).toBe(true)
  })

  it("rejects yesterday's score under today", () => {
    expect(qualifiesForTab('2026-08-11', 'today', WEDNESDAY)).toBe(false)
  })

  it('accepts Monday, the first day of this week', () => {
    expect(qualifiesForTab('2026-08-10', 'week', WEDNESDAY)).toBe(true)
  })

  it('rejects Sunday, the last day of last week — one day earlier, one week out', () => {
    expect(qualifiesForTab('2026-08-09', 'week', WEDNESDAY)).toBe(false)
  })

  it('rejects a score from six days ago when it fell in the previous week', () => {
    // A rolling seven-day window would have kept this; a calendar week does not.
    expect(qualifiesForTab('2026-08-06', 'week', WEDNESDAY)).toBe(false)
  })

  it('accepts anything under all time', () => {
    expect(qualifiesForTab('2019-01-01', 'forever', WEDNESDAY)).toBe(true)
  })
})
