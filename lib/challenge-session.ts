// A **session**: one planned appearance of a challenge — one challenge, one start, one
// end. The admin's booking, and the whole of the arithmetic behind the planner screen.
//
// Instants are `number` throughout, ms since the epoch, which is the unit every other
// clock in this app runs on. The database holds `timestamptz` and `listSessions` converts
// at the edge; nothing in here knows about it.
//
// Deliberately no React and no Supabase here. When a session opens is not worked out
// here at all any more: the server times the **queue** onto its noons (see
// 20261103000000_session_queue.sql), and the planner only orders and counts the rows.

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

// The planner's order: what is on now, then the **queue** in the order it will open, then
// what already ran, newest first.
//
// The queue reads earliest first because that is the order it runs in and the order its
// MOVE UP / MOVE DOWN mean anything in — a queue drawn newest-first would put "up" at the
// bottom. The past keeps the newest-first the whole list used to have, so last week sits
// right under the queue and last month falls away below.
const STATUS_RANK = { live: 0, upcoming: 1, expired: 2 } as const satisfies Record<
  SpanStatus,
  number
>

export const queueOrder = <T extends SessionSpan>(
  sessions: readonly T[],
  now: number,
): T[] =>
  sessions.toSorted((a, b) => {
    const status = spanStatus(a, now)
    const rank = STATUS_RANK[status] - STATUS_RANK[spanStatus(b, now)]
    if (rank !== 0) return rank
    return status === 'expired' ? b.opensAt - a.opensAt : a.opensAt - b.opensAt
  })

// How many sessions of each challenge have **closed** — the figure the challenge picker
// puts beside each name, because how often one has already run is what an admin choosing
// the next is choosing by. Live and queued ones are not counted: one that has not finished
// has not run. A challenge with none is simply absent; the caller reads it as nought.
export const pastCountByMode = (
  sessions: readonly (SessionSpan & { modeId: string })[],
  now: number,
): ReadonlyMap<string, number> =>
  sessions
    .filter((session) => spanStatus(session, now) === 'expired')
    .reduce(
      (counts, session) =>
        counts.set(session.modeId, (counts.get(session.modeId) ?? 0) + 1),
      new Map<string, number>(),
    )
