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

// What PLAN SESSION opens on: the first noon at or after the last session booked closes,
// through the noon after that — so a new booking queues up behind what is already
// planned instead of colliding with it. With nothing booked ahead of `now`, it is
// tomorrow at noon.
//
// "At or after", not "after": windows are half-open, so one opening at the instant the
// last one closes meets it end to end without overlapping, which is the point of a noon
// close.
//
// Built out of wall-clock noon twice over rather than as "noon plus twenty-four hours",
// and that distinction is the point. Across a daylight-saving boundary these two noons
// are 23 or 25 hours apart — which is what two noons *are*, and what was asked for. A
// dragged start behaves differently on purpose; see `withOpensAt`.
export function defaultSpan(
  now: number,
  lastClosesAt: number | null = null,
): SessionSpan {
  const noonAfter = (day: Date, dayOffset: number): number =>
    new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate() + dayOffset,
      DEFAULT_HOUR,
    ).getTime()
  if (lastClosesAt === null || lastClosesAt <= now) {
    const today = new Date(now)
    return { opensAt: noonAfter(today, 1), closesAt: noonAfter(today, 2) }
  }
  const closeDay = new Date(lastClosesAt)
  const opensAt =
    noonAfter(closeDay, 0) >= lastClosesAt
      ? noonAfter(closeDay, 0)
      : noonAfter(closeDay, 1)
  return { opensAt, closesAt: noonAfter(new Date(opensAt), 1) }
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
// A session is teased from the moment it is booked: anything planned and not yet open
// shows its countdown, however far off it is. There used to be a lead time — a general
// figure and a per-session override — and it is gone; a booking is the announcement.
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
    .filter((session) => spanStatus(session, now) === 'upcoming')
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
