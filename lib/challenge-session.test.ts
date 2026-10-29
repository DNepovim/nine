import { afterEach, describe, expect, it } from 'vitest'

import {
  cardSession,
  defaultSpan,
  isValidSpan,
  shownByStatus,
  spanStatus,
  withClosesAt,
  withOpensAt,
  type SpanStatus,
} from '@/lib/challenge-session'

const HOUR = 3600_000

// `defaultSpan` is built out of local wall-clock noon, so the zone the suite happens to
// run in decides the answer — and CI runs in UTC while a laptop does not. Pinned per
// test rather than globally: one of these tests is *about* a daylight-saving boundary
// and needs a zone that has one, and the rest want a zone that does not get in the way.
//
// Node re-reads `process.env.TZ` on the next `Date` operation, so assigning it mid-run
// is enough; nothing has to be reloaded.
const original = process.env.TZ
const inZone = (tz: string) => {
  process.env.TZ = tz
}
afterEach(() => {
  process.env.TZ = original
})

// Local noon on a given date, as an instant, read the same way `defaultSpan` builds one.
const noon = (year: number, month: number, day: number): number =>
  new Date(year, month - 1, day, 12).getTime()

describe('defaultSpan', () => {
  it('opens tomorrow at noon and closes the day after at noon with nothing booked', () => {
    inZone('Europe/Prague')
    const span = defaultSpan(new Date(2026, 5, 10, 9, 17).getTime())
    expect(span.opensAt).toBe(noon(2026, 6, 11))
    expect(span.closesAt).toBe(noon(2026, 6, 12))
  })

  it('counts tomorrow from the local day, not from the next 24 hours', () => {
    inZone('Europe/Prague')
    // Nine minutes to midnight. "Tomorrow" is the 11th, which is under an hour away —
    // a span measured forward from `now` would have landed on the 12th.
    const span = defaultSpan(new Date(2026, 5, 10, 23, 51).getTime())
    expect(span.opensAt).toBe(noon(2026, 6, 11))
  })

  it('rolls over the month and the year', () => {
    inZone('Europe/Prague')
    const span = defaultSpan(new Date(2026, 11, 31, 18, 0).getTime())
    expect(span.opensAt).toBe(noon(2027, 1, 1))
    expect(span.closesAt).toBe(noon(2027, 1, 2))
  })

  it('is two wall-clock noons, so it is 23 hours across a spring-forward', () => {
    inZone('Europe/Prague')
    // Prague puts the clocks forward on 29 March 2026. Noon on the 28th to noon on the
    // 29th is 23 hours, and that is the right answer: the admin asked for two noons.
    const span = defaultSpan(new Date(2026, 2, 27, 8, 0).getTime())
    expect(span.closesAt - span.opensAt).toBe(23 * HOUR)
  })

  it('is 25 hours across a fall-back, for the same reason', () => {
    inZone('Europe/Prague')
    // And back again on 25 October 2026.
    const span = defaultSpan(new Date(2026, 9, 23, 8, 0).getTime())
    expect(span.closesAt - span.opensAt).toBe(25 * HOUR)
  })
})

describe('defaultSpan after a booking', () => {
  it('opens at the noon the last session closes on, end to end', () => {
    inZone('Europe/Prague')
    const span = defaultSpan(new Date(2026, 5, 10, 9, 0).getTime(), noon(2026, 6, 14))
    expect(span.opensAt).toBe(noon(2026, 6, 14))
    expect(span.closesAt).toBe(noon(2026, 6, 15))
  })

  it('opens at the next noon when the last session closes past one', () => {
    inZone('Europe/Prague')
    const span = defaultSpan(
      new Date(2026, 5, 10, 9, 0).getTime(),
      new Date(2026, 5, 14, 18, 30).getTime(),
    )
    expect(span.opensAt).toBe(noon(2026, 6, 15))
  })

  it('falls back to tomorrow at noon when every booking has closed', () => {
    inZone('Europe/Prague')
    const span = defaultSpan(new Date(2026, 5, 10, 9, 0).getTime(), noon(2026, 6, 8))
    expect(span.opensAt).toBe(noon(2026, 6, 11))
  })
})

describe('withOpensAt', () => {
  it('moves the end by exactly what the start moved', () => {
    const span = { opensAt: 1000, closesAt: 5000 }
    expect(withOpensAt(span, 3500)).toStrictEqual({ opensAt: 3500, closesAt: 7500 })
  })

  it('keeps the span when the start moves backwards', () => {
    const span = { opensAt: 1000, closesAt: 5000 }
    expect(withOpensAt(span, 0).closesAt).toBe(4000)
  })

  it('holds the duration rather than the wall clock across a spring-forward', () => {
    inZone('Europe/Prague')
    // Two noons on either side of a boundary the span does *not* cross: 24 hours.
    const span = defaultSpan(new Date(2026, 5, 10, 9, 0).getTime())
    expect(span.closesAt - span.opensAt).toBe(24 * HOUR)
    // Dragged onto the boundary. `defaultSpan` would have produced 23 hours here; a
    // move keeps the 24 the admin already set, and so lands at 13:00 rather than noon.
    const moved = withOpensAt(span, noon(2026, 3, 28))
    expect(moved.closesAt - moved.opensAt).toBe(24 * HOUR)
    expect(moved.closesAt).not.toBe(noon(2026, 3, 29))
  })
})

describe('withClosesAt', () => {
  it('moves the end alone', () => {
    const span = { opensAt: 1000, closesAt: 5000 }
    expect(withClosesAt(span, 9000)).toStrictEqual({ opensAt: 1000, closesAt: 9000 })
  })
})

describe('isValidSpan', () => {
  it('accepts a span that closes after it opens', () => {
    expect(isValidSpan({ opensAt: 1000, closesAt: 1001 })).toBe(true)
  })

  it('refuses a span that closes when it opens', () => {
    expect(isValidSpan({ opensAt: 1000, closesAt: 1000 })).toBe(false)
  })

  it('refuses an inverted span', () => {
    expect(isValidSpan({ opensAt: 5000, closesAt: 1000 })).toBe(false)
  })
})

describe('spanStatus', () => {
  const span = { opensAt: 1000, closesAt: 5000 }

  it('is upcoming one ms before it opens', () => {
    expect(spanStatus(span, 999)).toBe('upcoming')
  })

  it('is live on the instant it opens', () => {
    expect(spanStatus(span, 1000)).toBe('live')
  })

  it('is live one ms before it closes', () => {
    expect(spanStatus(span, 4999)).toBe('live')
  })

  it('is expired on the instant it closes, so two spans meeting end to end never overlap', () => {
    expect(spanStatus(span, 5000)).toBe('expired')
  })
})

describe('cardSession', () => {
  const span = (opensAt: number, closesAt: number) => ({ opensAt, closesAt })
  const NOW = Date.parse('2026-06-10T12:00:00Z')
  const H = 3600_000

  it('draws nothing when there is nothing on and nothing coming', () => {
    expect(cardSession([], NOW)).toBeNull()
    // A session that has already closed is not a card.
    expect(cardSession([span(NOW - 5 * H, NOW - H)], NOW)).toBeNull()
  })

  it('draws a live session', () => {
    const live = span(NOW - H, NOW + H)
    expect(cardSession([live], NOW)).toEqual({ state: 'live', session: live })
  })

  it('prefers live over teased', () => {
    const live = span(NOW - H, NOW + H)
    const teased = span(NOW + 20 * H, NOW + 40 * H)
    expect(cardSession([teased, live], NOW)).toEqual({ state: 'live', session: live })
  })

  it('among several live, takes the one closing soonest', () => {
    const soon = span(NOW - H, NOW + H)
    const later = span(NOW - 2 * H, NOW + 5 * H)
    expect(cardSession([later, soon], NOW)).toEqual({ state: 'live', session: soon })
  })

  it('teases a session from the moment it is booked, however far off it opens', () => {
    // Opens in a month. There is no lead time any more: planned is announced.
    const far = span(NOW + 30 * 24 * H, NOW + 31 * 24 * H)
    expect(cardSession([far], NOW)).toEqual({ state: 'teaser', session: far })
  })

  it('among several teased, takes the one opening soonest', () => {
    const first = span(NOW + 20 * H, NOW + 30 * H)
    const second = span(NOW + 30 * H, NOW + 40 * H)
    expect(cardSession([second, first], NOW)).toEqual({ state: 'teaser', session: first })
  })

  it('does not reorder the array it was handed', () => {
    // It sorts to choose; sorting the caller's list in place would quietly reorder the
    // planner's own rows, which are newest-first for a reason.
    const a = span(NOW - H, NOW + 5 * H)
    const b = span(NOW - 2 * H, NOW + H)
    const given = [a, b]
    cardSession(given, NOW)
    expect(given).toEqual([a, b])
  })
})

describe('shownByStatus', () => {
  const NOW = Date.parse('2026-06-10T12:00:00Z')
  const H = 3600_000
  const live = { opensAt: NOW - H, closesAt: NOW + H }
  const upcoming = { opensAt: NOW + H, closesAt: NOW + 2 * H }
  const expired = { opensAt: NOW - 3 * H, closesAt: NOW - 2 * H }
  const all = [live, upcoming, expired]

  const shown = (...enabled: SpanStatus[]) => shownByStatus(all, new Set(enabled), NOW)

  it('draws nothing when no filter is lit', () => {
    // The honest answer rather than a special case: the admin turned everything off, and
    // showing all three would be overruling them.
    expect(shown()).toEqual([])
  })

  it('draws one status at a time', () => {
    expect(shown('live')).toEqual([live])
    expect(shown('upcoming')).toEqual([upcoming])
    expect(shown('expired')).toEqual([expired])
  })

  it('adds rather than replaces when a second is lit', () => {
    expect(shown('live', 'upcoming')).toEqual([live, upcoming])
    // The pair the old four pills could not say: everything except what is still to come.
    expect(shown('live', 'expired')).toEqual([live, expired])
    expect(shown('upcoming', 'expired')).toEqual([upcoming, expired])
  })

  it('draws everything when all three are lit, which is what ALL used to mean', () => {
    expect(shown('live', 'upcoming', 'expired')).toEqual(all)
  })

  it('keeps the order it was handed rather than grouping by status', () => {
    // The planner orders by start date, newest first, and filtering must not regroup it.
    expect(
      shownByStatus([expired, live, upcoming], new Set(['live', 'expired']), NOW),
    ).toEqual([expired, live])
  })
})
