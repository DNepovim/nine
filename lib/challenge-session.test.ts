import { describe, expect, it } from 'vitest'

import {
  cardSession,
  pastRunsByMode,
  queueOrder,
  shownByStatus,
  spanStatus,
  type SpanStatus,
} from '@/lib/challenge-session'

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
    // The planner orders the rows with `queueOrder` first, and filtering must not regroup it.
    expect(
      shownByStatus([expired, live, upcoming], new Set(['live', 'expired']), NOW),
    ).toEqual([expired, live])
  })
})

describe('queueOrder', () => {
  const NOW = Date.parse('2026-06-10T12:00:00Z')
  const H = 3600_000
  const live = { opensAt: NOW - H, closesAt: NOW + H }
  const next = { opensAt: NOW + 2 * H, closesAt: NOW + 3 * H }
  const later = { opensAt: NOW + 4 * H, closesAt: NOW + 5 * H }
  const lastWeek = { opensAt: NOW - 7 * 24 * H, closesAt: NOW - 6 * 24 * H }
  const yesterday = { opensAt: NOW - 2 * 24 * H, closesAt: NOW - 24 * H }

  it('puts live first, the queue earliest first, and the past newest first', () => {
    expect(queueOrder([lastWeek, later, yesterday, live, next], NOW)).toEqual([
      live,
      next,
      later,
      yesterday,
      lastWeek,
    ])
  })

  it('leaves what it was handed alone', () => {
    const given = [later, next]
    queueOrder(given, NOW)
    expect(given).toEqual([later, next])
  })
})

describe('pastRunsByMode', () => {
  const NOW = Date.parse('2026-06-10T12:00:00Z')
  const H = 3600_000
  const past = (modeId: string, closedHoursAgo = 2) => ({
    modeId,
    opensAt: NOW - (closedHoursAgo + 1) * H,
    closesAt: NOW - closedHoursAgo * H,
  })

  it('counts closed sessions per challenge', () => {
    const runs = pastRunsByMode([past('a'), past('a'), past('b')], NOW)
    expect(runs.get('a')?.count).toBe(2)
    expect(runs.get('b')?.count).toBe(1)
  })

  it('keeps when the latest closed session ended, in any order', () => {
    const runs = pastRunsByMode([past('a', 5), past('a', 2), past('a', 9)], NOW)
    expect(runs.get('a')?.lastClosedAt).toBe(NOW - 2 * H)
  })

  it('does not count a live or queued session, and leaves an unrun challenge absent', () => {
    const runs = pastRunsByMode(
      [
        { modeId: 'a', opensAt: NOW - H, closesAt: NOW + H },
        { modeId: 'b', opensAt: NOW + H, closesAt: NOW + 2 * H },
      ],
      NOW,
    )
    expect(runs.size).toBe(0)
  })
})
