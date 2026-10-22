import { describe, expect, it } from 'vitest'

import type { SessionSpan } from '@/lib/challenge-session'
import { challengeId } from '@/modes'

import {
  SUMMARY_LOOKBACK_MS,
  summaryInvite,
  summaryOwed,
  summarySince,
  type SessionSummary,
} from './session-summary'

const NOW = Date.UTC(2026, 9, 20, 12)
const HOUR = 60 * 60 * 1000

// Real registered challenges, because `summaryOwed` asks `modeById` whether it could draw
// one. A made-up id would make every row undrawable and quietly pass the wrong test.
const KNOWN = challengeId('four-keys')
const ALSO_KNOWN = challengeId('habit')
// A challenge this build has never heard of — a device older than the server, which is
// the ordinary way it happens.
const UNKNOWN = challengeId('a-challenge-from-the-future')

// A podium of one. Every summary needs somebody on it to be drawable at all — see the
// empty-podium rule in `summaryOwed` — so the default fixture carries a winner.
const WINNER = {
  rank: 1,
  nickname: 'DONDA',
  score: 900,
  timeMs: null,
  avgAccuracy: null,
  avgSpeed: null,
} as const

const summary = (
  modeId: string,
  closesAt: number,
  places: SessionSummary['places'] = [WINNER],
): SessionSummary => ({
  sessionId: `s-${String(closesAt)}`,
  modeId,
  closesAt,
  measure: 'score',
  places,
  players: places.length,
  mine: { rank: null, score: 100, timeMs: null, difficulty: 'hard', bonus: 0 },
})

const span = (opensAt: number, closesAt: number): SessionSpan => ({ opensAt, closesAt })

describe('summarySince', () => {
  it('asks from the marker when the marker is inside the lookback', () => {
    expect(summarySince(NOW - HOUR, NOW)).toBe(NOW - HOUR)
  })

  it('never asks further back than the lookback, however old the marker', () => {
    expect(summarySince(0, NOW)).toBe(NOW - SUMMARY_LOOKBACK_MS)
  })
})

describe('summaryOwed', () => {
  it('owes nothing when nothing closed', () => {
    expect(summaryOwed([])).toBeNull()
  })

  it('owes the one session there is, and moves the marker to its close', () => {
    const only = summary(KNOWN, NOW - HOUR)
    expect(summaryOwed([only])).toEqual({ summary: only, through: NOW - HOUR })
  })

  it('tells the newest of several and marks the rest told', () => {
    const older = summary(KNOWN, NOW - 5 * HOUR)
    const newest = summary(ALSO_KNOWN, NOW - HOUR)
    expect(summaryOwed([older, newest])).toEqual({ summary: newest, through: NOW - HOUR })
  })

  it('does not trust the order it is handed', () => {
    const older = summary(KNOWN, NOW - 5 * HOUR)
    const newest = summary(ALSO_KNOWN, NOW - HOUR)
    expect(summaryOwed([newest, older])?.summary).toBe(newest)
  })

  it('skips a challenge it cannot draw but still marks it told', () => {
    const drawable = summary(KNOWN, NOW - 5 * HOUR)
    const future = summary(UNKNOWN, NOW - HOUR)
    // The page shows the older one; the marker moves past the newer one all the same, or
    // a session this build can never draw is re-offered on every launch forever.
    expect(summaryOwed([drawable, future])).toEqual({
      summary: drawable,
      through: NOW - HOUR,
    })
  })

  it('shows nothing when no session can be drawn, and still moves the marker', () => {
    expect(summaryOwed([summary(UNKNOWN, NOW - HOUR)])).toEqual({
      summary: null,
      through: NOW - HOUR,
    })
  })

  it('skips a session nobody is on the podium of', () => {
    // Only reachable by a reader with no nickname, who is kept off the standings they
    // played in. There is no result to report, so there is no page — and the marker
    // still moves, or it would be asked about on every launch forever.
    expect(summaryOwed([summary(KNOWN, NOW - HOUR, [])])).toEqual({
      summary: null,
      through: NOW - HOUR,
    })
  })

  it('falls back to an older session when the newest has an empty podium', () => {
    const played = summary(KNOWN, NOW - 5 * HOUR)
    const bare = summary(ALSO_KNOWN, NOW - HOUR, [])
    expect(summaryOwed([played, bare])).toEqual({
      summary: played,
      through: NOW - HOUR,
    })
  })
})

describe('summaryInvite', () => {
  it('names nothing when nothing is on or coming', () => {
    expect(summaryInvite([], NOW)).toBeNull()
  })

  it('names a live session over one still teasing, and says which it is', () => {
    const live = span(NOW - HOUR, NOW + HOUR)
    const soon = span(NOW + HOUR, NOW + 3 * HOUR)
    // The face rides along because the clock under the name counts towards a different
    // instant for each: a live session towards its close, a teased one towards its open.
    expect(summaryInvite([soon, live], NOW)).toEqual({ state: 'live', session: live })
  })

  it('names one still to come, however far off', () => {
    const teased = span(NOW + 48 * HOUR, NOW + 72 * HOUR)
    expect(summaryInvite([teased], NOW)).toEqual({ state: 'teaser', session: teased })
  })
})
