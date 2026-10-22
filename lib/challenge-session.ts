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

export type SessionSpan = {
  opensAt: number
  closesAt: number
}

// A span that knows how long its own teaser runs. The figure arrives already resolved —
// the session's own if it has one, the general one if it does not, coalesced by
// `open_sessions_with_leaders` — so nothing on this side has an opinion about what a
// missing figure means. See `teaserOpensAt`.
export type TeasedSpan = SessionSpan & {
  teaserMinutes: number
}

// Live, still to come, or over. The same three words `dev-overlay.tsx` already used for
// a challenge's compiled window, kept rather than renamed: one vocabulary for one set of
// states, whether the span came from the catalog or from a row.
export type SpanStatus = 'upcoming' | 'live' | 'expired'

// Not translated, and not an oversight — the same reason the admin screen's tab pills
// are not. These name the state of a database row on a screen whose readers are the
// people who write the catalog, and they sit beside challenge ids and raw timestamps.
export const STATUS_LABEL = {
  live: 'LIVE',
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

// When a session's **teaser** appears: this many minutes before it opens.
//
// It used to be midnight Prague on the day before, and that was two promises rather than
// one. The first was zone-independence — a challenge must not show up a day early for
// some players and on time for others — and a duration before an instant keeps it, since
// an instant is the same instant everywhere. The second was that a player who opens the
// app once a day sees the thing coming at least once before it arrives, and a duration
// **does not** keep that: set this to two hours and a daily player can miss the teaser
// entirely. That is the trade the figure buys, and the reason the general default is
// seeded at the thirty-six hours the app already behaved as — nothing moves until
// somebody decides to move it.
//
// Zero is a legitimate answer and means no teaser at all: the card appears when the
// session opens. Nothing here floors it, because the admin can see what it did.
export const teaserOpensAt = (opensAt: number, teaserMinutes: number): number =>
  opensAt - teaserMinutes * 60_000

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
export function cardSession<T extends TeasedSpan>(
  sessions: readonly T[],
  now: number,
): SessionCard<T> {
  const live = sessions
    .filter((session) => spanStatus(session, now) === 'live')
    .sort((a, b) => a.closesAt - b.closesAt)[0]
  if (live !== undefined) return { state: 'live', session: live }

  // Each row against its **own** teaser rather than one rule over all of them: a session
  // carrying an override teases on its own schedule, and two sessions coming up on the
  // same evening can quite legitimately start announcing themselves hours apart.
  const teased = sessions
    .filter(
      (session) =>
        spanStatus(session, now) === 'upcoming' &&
        now >= teaserOpensAt(session.opensAt, session.teaserMinutes),
    )
    .sort((a, b) => a.opensAt - b.opensAt)[0]
  return teased === undefined ? null : { state: 'teaser', session: teased }
}

// ─── What the planner draws ──────────────────────────────────────────────────

// The rows a set of lit filters asks for.
//
// A set rather than one chosen status, which is what the pills above the planner used to
// hand down: the four of them included an ALL that was the union of the other three, and
// a pill that is the sum of its neighbours is not a filter. Three toggles say everything
// four radio buttons said and several things they could not — LIVE and PAST together,
// say, which is every session except the ones still to come.
//
// An empty set draws nothing, and that is the honest answer rather than a special case:
// the admin turned every filter off, and a list that responded by showing everything
// would be overruling them.
export const shownByStatus = <T extends SessionSpan>(
  sessions: readonly T[],
  enabled: ReadonlySet<SpanStatus>,
  now: number,
): T[] => sessions.filter((session) => enabled.has(spanStatus(session, now)))
