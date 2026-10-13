import { describe, expect, it } from 'vitest'

import {
  dayInPrague,
  msUntilNextDay,
  previousDay,
  previousWeek,
  qualifiesForTab,
  startOfDayInPrague,
  tabSince,
  weekStart,
} from './leaderboard-period'

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

describe('msUntilNextDay', () => {
  const MINUTE = 60_000

  it('counts the half hour left before Prague midnight in summer', () => {
    // 21:30 UTC = 23:30 CEST.
    expect(msUntilNextDay(new Date('2026-08-12T21:30:00Z'))).toBe(30 * MINUTE)
  })

  it('counts the half hour left before Prague midnight in winter', () => {
    // 22:30 UTC = 23:30 CET.
    expect(msUntilNextDay(new Date('2026-01-12T22:30:00Z'))).toBe(30 * MINUTE)
  })

  it('is a whole day the instant a day begins', () => {
    // 22:00 UTC = 00:00 CEST.
    expect(msUntilNextDay(new Date('2026-08-12T22:00:00Z'))).toBe(24 * 60 * MINUTE)
  })

  it('lands on the moment the day actually turns', () => {
    const at = new Date('2026-08-12T09:17:23.456Z')
    const next = new Date(at.getTime() + msUntilNextDay(at))
    expect(dayInPrague(next)).not.toBe(dayInPrague(at))
    expect(dayInPrague(new Date(next.getTime() - 1))).toBe(dayInPrague(at))
  })
})

describe('previousDay', () => {
  it('steps back one day', () => {
    expect(previousDay('2026-09-21')).toBe('2026-09-20')
  })

  it('crosses into the previous month', () => {
    expect(previousDay('2026-09-01')).toBe('2026-08-31')
  })

  it('crosses into the previous year', () => {
    expect(previousDay('2026-01-01')).toBe('2025-12-31')
  })
})

describe('previousWeek', () => {
  it('is the Monday-to-Sunday week before the one containing the day', () => {
    // 2026-09-21 is a Monday, so its own week has only just begun.
    expect(previousWeek('2026-09-21')).toEqual({ from: '2026-09-14', to: '2026-09-20' })
  })

  it('reads the same from any day inside the current week', () => {
    // Sunday 2026-09-20 closes the week that began Monday 2026-09-14.
    expect(previousWeek('2026-09-20')).toEqual({ from: '2026-09-07', to: '2026-09-13' })
  })

  it('crosses into the previous year', () => {
    // Friday 2026-01-02 sits in the week starting Monday 2025-12-29.
    expect(previousWeek('2026-01-02')).toEqual({ from: '2025-12-22', to: '2025-12-28' })
  })

  it('ends the day before the current week starts', () => {
    const day = '2026-03-01'
    expect(previousWeek(day).to).toBe(previousDay(weekStart(day)))
  })
})

describe('startOfDayInPrague', () => {
  // Round-trip against `dayInPrague`, which is the property that matters: the instant
  // this returns must be the first millisecond that reads as that day in Prague.
  const roundTrips = (day: string) => {
    const at = startOfDayInPrague(day)
    return [dayInPrague(new Date(at)), dayInPrague(new Date(at - 1))]
  }

  it('lands on the first millisecond of a winter day', () => {
    expect(roundTrips('2026-01-15')).toEqual(['2026-01-15', '2026-01-14'])
    // CET is UTC+1, so Prague midnight is 23:00 UTC the day before.
    expect(new Date(startOfDayInPrague('2026-01-15')).toISOString()).toBe(
      '2026-01-14T23:00:00.000Z',
    )
  })

  it('lands on the first millisecond of a summer day', () => {
    expect(roundTrips('2026-07-15')).toEqual(['2026-07-15', '2026-07-14'])
    // CEST is UTC+2.
    expect(new Date(startOfDayInPrague('2026-07-15')).toISOString()).toBe(
      '2026-07-14T22:00:00.000Z',
    )
  })

  it('is right on the day the clocks go forward', () => {
    // 29 March 2026. The day begins in CET and ends in CEST, so its midnight is the
    // winter one — the single-pass reading would put it an hour out.
    expect(roundTrips('2026-03-29')).toEqual(['2026-03-29', '2026-03-28'])
    expect(new Date(startOfDayInPrague('2026-03-29')).toISOString()).toBe(
      '2026-03-28T23:00:00.000Z',
    )
  })

  it('is right on the day the clocks go back', () => {
    // 25 October 2026, the other way round: begins in CEST.
    expect(roundTrips('2026-10-25')).toEqual(['2026-10-25', '2026-10-24'])
    expect(new Date(startOfDayInPrague('2026-10-25')).toISOString()).toBe(
      '2026-10-24T22:00:00.000Z',
    )
  })

  it('round-trips every day across both changeovers', () => {
    // A sweep rather than four examples: the two edges are where a one-pass answer goes
    // wrong, and this is what would catch a third case nobody thought of. The property
    // is the whole of it — the instant returned reads back as the day asked for, and
    // the millisecond before it reads as the day before.
    for (const prefix of ['2026-03-2', '2026-10-2']) {
      for (let d = 5; d <= 9; d++) {
        const day = `${prefix}${d}`
        const at = startOfDayInPrague(day)
        expect(dayInPrague(new Date(at)), day).toBe(day)
        expect(dayInPrague(new Date(at - 1)), day).not.toBe(day)
      }
    }
  })
})
