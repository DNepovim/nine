import { isNonEmptyArray } from 'narrowland'

import { cardSession, type SessionCard, type TeasedSpan } from '@/lib/challenge-session'
import { modeById, type Difficulty, type Measure } from '@/modes'

// A **summary**: what one closed **session** came to.
//
// Told once, on the first intro a player reaches after the window shuts, and only to
// somebody who played it. Its three **places**, where that player themselves came, and an
// invitation to whatever is on next — then it is gone. A summary is never kept and never
// re-opened, which is what it has in common with a **recap** and what keeps it from being
// a **session board**: the board is a thing you can go and look at, and this is a thing
// you are told.
//
// Everything here is pure. The read is `lib/session-summaries.ts`, the watermark and the
// waking are `hooks/use-session-summaries.ts`, and the page is `summary-card.tsx`.

// One place on the podium. Gold, silver, bronze and nothing else — a summary is the three
// and the player, never a table.
export type SummaryPlace = {
  rank: 1 | 2 | 3
  nickname: string
  score: number
  // What the run took, where the session is **measured** by the clock. Null on a
  // score-measured session, which has no time to show.
  timeMs: number | null
  // Nullable for the reason every other name in the app is: a player the counters have
  // never seen has no saturation, and `nameColors` draws them uncoloured. A nought here
  // would make "never counted" and "counted, and bad at it" the same colour.
  avgAccuracy: number | null
  avgSpeed: number | null
}

export type SessionSummary = {
  sessionId: string
  modeId: string
  closesAt: number
  measure: Measure
  // Ranked, best first. Empty for a session nobody scored on — which can only happen to
  // a player with no nickname, since anybody else who played it is on it.
  places: readonly SummaryPlace[]
  // The whole board, not the podium.
  players: number
  // Always present: eligibility *is* having a row, so a player being owed a summary and a
  // player having a figure on it are the same fact. `rank` is null for a player with no
  // nickname, who is kept off every board in this app and off this podium too — they
  // still have their own score, which is the one thing the page can still say.
  mine: {
    rank: number | null
    score: number
    timeMs: number | null
    // The rung the run was played at. Kept because the page says which rung the figures
    // beside it were set on, not because it prices anything — pricing is the server's.
    difficulty: Difficulty
    // What this **place** paid into the player's fortune, already weighted and already
    // decided by the one function that pays it — `session_podium_bonus`. Nought off the
    // podium, nought inside the grace while the standings can still move, and nought for
    // a session that closed before the podium began paying.
    //
    // Carried rather than computed. A share table on this side would be a second opinion
    // about money, and it was exactly that for one pass: it had no watermark, so a
    // session older than `session_podium_from()` printed a figure the fortune never
    // received.
    bonus: number
  }
}

// How far back a launch asks. A fortnight: long enough that a player away for a week
// still hears about the contest they played, short enough that a podium nobody remembers
// entering is not the first thing a returning player meets.
//
// Deliberately a span rather than "everything since the marker". A device that has not
// been opened in three months would otherwise ask about three months, and the one thing
// it is owed is the most recent of them — which is what the server's own thirty-day floor
// is a guard against rather than a statement of. The two figures are not the same number
// on purpose.
export const SUMMARY_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000

// What to ask the server about: everything since the marker, but never further back than
// the lookback. `Math.max` rather than a branch — the marker overtakes the lookback the
// moment the app is opened twice in a fortnight, which is the ordinary case.
export const summarySince = (marker: number, now: number): number =>
  Math.max(marker, now - SUMMARY_LOOKBACK_MS)

// What a set of closed sessions comes to: one to tell, and where the marker goes.
//
// The two are **not** the same figure, and that is the whole reason this returns a pair.
// `summary` is the newest session this build can actually draw; `through` is the newest
// close of them all. They differ when the newest session names a challenge this build has
// never heard of — a device older than the server, which is the ordinary way it happens.
// Advancing the marker to the page shown would leave the unknown one unmarked, and it
// would be offered again on every launch forever, never drawable and never cleared.
export type Owed = {
  // Null when nothing in the window is worth drawing — see `summaryOwed` for the two
  // things that disqualify one. The marker still moves: there is nothing to say and
  // there never will be.
  summary: SessionSummary | null
  through: number
}

// Which summary is owed, out of everything the server handed back.
//
// **One, and only ever one.** A summary speaks for a contest that is over, and the one
// that just ended is the only one anybody is still thinking about — a dialog that opened
// on four podiums in a row would be a dialog nobody read to the end. The rest are marked
// told without being told, which is the same bargain the **recap** strikes with a player
// who was away for a month.
//
// `null` only when there is nothing at all. A set of rows always moves the marker.
export function summaryOwed(rows: readonly SessionSummary[]): Owed | null {
  const newest = latest(rows)
  if (newest === undefined) return null
  const drawable = rows.filter(
    (row) =>
      // A session naming a challenge this build has never heard of has no name to print
      // and no colours to print it in. The same answer `modeById` gives everywhere else.
      modeById(row.modeId) !== null &&
      // And a session with nobody on its podium has no result to report. It is a narrow
      // case — the reader played it, so somebody did — and it means the reader has no
      // nickname and is therefore kept off the standings, like every board in this app
      // keeps them. A page saying only that nobody scored, to the one person who did, is
      // worse than no page: the marker still advances and the dialog never opens.
      isNonEmptyArray(row.places),
  )
  return { summary: latest(drawable) ?? null, through: newest.closesAt }
}

// The newest close. A reduce rather than a sort: the caller is handed the server's order
// and should not have to trust it, and this does not care to copy an array to find one row.
const latest = (rows: readonly SessionSummary[]): SessionSummary | undefined =>
  rows.reduce<SessionSummary | undefined>(
    (best, row) => (best === undefined || row.closesAt > best.closesAt ? row : best),
    undefined,
  )

// What the page invites the player to next, or nothing.
//
// `cardSession` itself rather than a rule of its own, and that is the point: it is the
// function the intro already uses to decide which session it may speak about at all,
// **teaser** included. Naming one here that the start screen is not yet allowed to name
// would be the summary announcing a challenge early through a side door.
//
// The **card** rather than the session inside it, because the two faces count towards
// different instants: a teased session is counting to its open, a live one to its close.
// Dropping the state here would leave the page with a clock and no way to know which.
export const summaryInvite = <T extends TeasedSpan>(
  sessions: readonly T[],
  now: number,
): SessionCard<T> => cardSession(sessions, now)
