// A **session**: one planned appearance of a challenge — one challenge, one start, one
// end. The admin's booking, and the whole of the arithmetic behind the planner screen.
//
// Instants are `number` throughout, ms since the epoch, which is the unit every other
// clock in this app runs on. The two edges convert: the picker hands back a `Date`, and
// the database holds `timestamptz`. Nothing in between knows about either.
//
// Deliberately no React and no Supabase here. The planner's one genuinely subtle fact —
// that the default pair and a dragged start follow *different* rules across a
// daylight-saving boundary — is a thing a test can pin, and this is the file it is
// pinned in.

import { dayInPrague, previousDay, startOfDayInPrague } from '@/lib/leaderboard-period'

export type SessionSpan = {
  opensAt: number
  closesAt: number
}

// Live, still to come, or over. The same three words `dev-overlay.tsx` already used for
// a challenge's compiled window, kept rather than renamed: one vocabulary for one set of
// states, whether the span came from the catalog or from a row.
export type SpanStatus = 'upcoming' | 'live' | 'expired'

// Not translated, and not an oversight — the same reason the admin screen's tab pills
// are not. These name the state of a database row on a screen whose readers are the
// people who write the catalog, and they sit beside challenge ids and raw timestamps.
export const STATUS_LABEL = {
  live: 'LIVE NOW',
  upcoming: 'UPCOMING',
  expired: 'EXPIRED',
} as const satisfies Record<SpanStatus, string>

// The hour a session opens and closes on by default. Noon rather than midnight: a
// window that turns over in the middle of the night turns over while nobody is playing,
// and the day a challenge is "on" should be a day a player recognises as one.
const DEFAULT_HOUR = 12

// What PLAN SESSION opens on: tomorrow at noon, through the day after at noon.
//
// Built out of wall-clock noon twice over rather than as "noon plus twenty-four hours",
// and that distinction is the point. Across a daylight-saving boundary these two noons
// are 23 or 25 hours apart — which is what two noons *are*, and what was asked for. A
// dragged start behaves differently on purpose; see `withOpensAt`.
export function defaultSpan(now: number): SessionSpan {
  const today = new Date(now)
  const noonOn = (dayOffset: number): number =>
    new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + dayOffset,
      DEFAULT_HOUR,
    ).getTime()
  return { opensAt: noonOn(1), closesAt: noonOn(2) }
}

// The start moved, the span kept.
//
// What is held steady is the duration in **milliseconds**, not the wall-clock end — so a
// session dragged across a daylight-saving boundary stays the twenty-four hours it was
// rather than staying noon-to-noon. The admin set a length; moving when it begins is not
// a request to change how long it runs.
export const withOpensAt = (span: SessionSpan, opensAt: number): SessionSpan => ({
  opensAt,
  closesAt: opensAt + (span.closesAt - span.opensAt),
})

// The end moved, and nothing else. The one direction that does not drag its partner: an
// admin changing the end *is* asking for a different length, which is the whole reason
// the field is there.
export const withClosesAt = (span: SessionSpan, closesAt: number): SessionSpan => ({
  opensAt: span.opensAt,
  closesAt,
})

// Whether this is a span at all. A session that closes when it opens is not a short
// session, it is a session nobody can play — and the database refuses it too, with a
// check constraint, because this answer has to hold against a caller that is not the
// planner screen.
export const isValidSpan = (span: SessionSpan): boolean => span.closesAt > span.opensAt

// Where a span stands against a moment.
//
// Half-open, matching `isOpenMode`'s `>= from && < until`: a session is live from the
// instant it opens and expired from the instant it closes, so two sessions that meet end
// to end never both answer live for the same millisecond.
export function spanStatus(span: SessionSpan, now: number): SpanStatus {
  if (now < span.opensAt) return 'upcoming'
  if (now >= span.closesAt) return 'expired'
  return 'live'
}

// ─── What the start screen draws ─────────────────────────────────────────────

// When a session's **teaser** appears: midnight Prague on the day before it opens.
//
// Prague because that is the clock every board in this app is reckoned by, and a
// challenge that showed up a day early for some players and on time for others would
// be the first thing in the app whose timing depended on where you were standing.
//
// A day before rather than an hour, so a player who opens the app once a day sees the
// thing coming at least once before it arrives.
export const teaserOpensAt = (opensAt: number): number =>
  startOfDayInPrague(previousDay(dayInPrague(new Date(opensAt))))

// The one session the card is for, and which of its two faces it wears.
//
// `null` is the usual answer: most days there is nothing on and nothing coming.
export type SessionCard<T extends SessionSpan> =
  { state: 'teaser'; session: T } | { state: 'live'; session: T } | null

// Which session the intro draws, out of everything the server handed back.
//
// Live beats teased — something playable now outbids something playable tomorrow. Among
// several live, the one closing soonest, because it is the one a player can still miss.
// Among several teased, the one opening soonest, for the same reason read forwards.
//
// Nothing stacks. The planner refuses two overlapping sessions of the *same* challenge
// but not of different ones, so two at once is possible and this is where the app
// decides it draws one card rather than a row of them.
//
// Generic over the span so this can be given whatever shape the caller is holding — the
// card's own rows carry a leader, the admin's do not — rather than forcing one type on
// both and making the pure half depend on the server's.
export function cardSession<T extends SessionSpan>(
  sessions: readonly T[],
  now: number,
): SessionCard<T> {
  const live = sessions
    .filter((session) => spanStatus(session, now) === 'live')
    .sort((a, b) => a.closesAt - b.closesAt)[0]
  if (live !== undefined) return { state: 'live', session: live }

  const teased = sessions
    .filter(
      (session) =>
        spanStatus(session, now) === 'upcoming' && now >= teaserOpensAt(session.opensAt),
    )
    .sort((a, b) => a.opensAt - b.opensAt)[0]
  return teased === undefined ? null : { state: 'teaser', session: teased }
}
