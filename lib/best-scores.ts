// The best-scores strip's cells: which it draws, what each is called, and what colour it
// wears — on a board run and on a session run.

import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'

import { SPECTRUM } from '@/constants/colors'
import type { RecordHolder } from '@/hooks/use-board'
import { gradientOf, isChallenge, type Measure, type ModeId } from '@/modes'
import { challengeInk } from '@/modes/challenges/palette'

// The four periods of a board, plus the one a **session** has instead of them. Never
// both: a mode either keeps a board or belongs to a session, and `traitsOf(mode).board`
// is the question that decides which face this strip wears.
export type BestKey = 'you' | 'today' | 'week' | 'ever' | 'session' | 'last'

// What a run that belongs to a session knows about it.
export type SessionBests = {
  // What the two figures below are: scores, or on a race the times the standings are
  // ordered by — in which case both are ms, and 0 still means nobody has posted one.
  measure: Measure
  // The top score on the session board, or 0 where nobody has posted one yet — the same
  // answer an untouched board gives, and drawn the same way.
  best: number
  // Who holds it, or null where the read has not landed or nobody holds it.
  holder: RecordHolder | null
  // Whether that top score is the player's own, which the cell says as YOU rather than
  // by printing the name they already know.
  mine: boolean
  // The player's own best in this session, or 0 before they have posted one. What the
  // YOUR BEST cell shows on a session run: the device's per-board bests are keyed by mode
  // and difficulty, and a challenge keeps no board, so read from there it was always 0.
  myBest: number
  // Who won this challenge the last time it was aired, with the figure they won it on —
  // ms on a race, like the two above, and a score everywhere else. Null on its first
  // airing, which draws no third cell rather than an empty one.
  last: { holder: RecordHolder; value: number; mine: boolean } | null
  // When the window shuts, ms since the epoch. The one figure on this strip that is not
  // a score.
  closesAt: number
}

// A score that survived the "is there anything to show?" filter, with whatever goes on
// the line under it: a player to name, or a word where a name would be the wrong thing
// to write. Never both, and never neither — see `secondLine`.
export type ShownBest = {
  key: BestKey
  value: number | string
  mine: boolean
  holder: RecordHolder | null
  sub: string | null
  // Whose profile this cell opens, or null where there is nobody behind it to read.
  profileId: string | null
}

export const BEST_LABELS = {
  you: msg`YOUR`,
  today: msg`TODAY`,
  week: msg`WEEK`,
  ever: msg`EVER`,
  // Not THIS CHALLENGE: the top bar two rows up already names the challenge, and the
  // cell has one short line to say which of the two scores beside it this is.
  session: msg`SESSION`,
  // The previous airing of the same challenge, whose winner sits under it.
  last: msg`LAST`,
} as const satisfies Record<BestKey, MessageDescriptor>

// The player's own cell is one phrase across the cell's two lines — YOUR / BEST — where
// the other three are a period over the player holding it. It reads as a label rather
// than as a name because that is what it is: the one score on this row that is not a
// record anybody holds, just the best the device remembers.
export const YOUR_BEST = msg`BEST`

// A record the player holds names them as YOU. Their own nickname would be the board
// telling them who they are, and it is the only name on the row they already know.
export const HELD_BY_ME = msg`YOU`

// One step along the game spectrum per score, coolest to hottest: your own best,
// then the day, the week, and all time.
const BEST_COLORS = {
  you: SPECTRUM[0],
  today: SPECTRUM[1],
  week: SPECTRUM[2],
  ever: SPECTRUM[3],
  // Overridden per challenge — see `cellColor`. The entry is here so the table stays
  // exhaustive over `BestKey`, and the stop is the one the four-cell row ends on, which
  // is what a lone second cell would want if a challenge ever had no colour of its own.
  session: SPECTRUM[3],
  // Also overridden per challenge: it is the same contest, aired before.
  last: SPECTRUM[3],
} as const satisfies Record<BestKey, string>

const BEST_ORDER = ['you', 'today', 'week', 'ever'] as const satisfies readonly BestKey[]

// What a session run shows instead: what the player has done, and what the session has.
// Two cells and not four, because a session has no day, week or all time to be the best
// of — it is its own window, which is the whole of why it needs none of the three.
const SESSION_ORDER = ['you', 'session'] as const satisfies readonly BestKey[]

// And with the last airing's winner beside them, where the challenge has had one.
const SESSION_WITH_LAST = ['you', 'session', 'last'] as const satisfies readonly BestKey[]

// And what is left when the three server-backed cells cannot be reached.
const ONLY_YOURS = ['you'] as const satisfies readonly BestKey[]

// Which cells the row draws.
//
// A session run shows its own two whether or not the device is online: `you` is off the
// device and the session's best was read before the run was dealt, so neither is a thing
// the connection can take away mid-run. A board run offline drops the three that are the
// server's — a 0 there would misreport an empty board rather than an unreachable one.
export const keysFor = (
  session: SessionBests | null,
  online: boolean,
): readonly BestKey[] => {
  if (session !== null) return session.last === null ? SESSION_ORDER : SESSION_WITH_LAST
  return online ? BEST_ORDER : ONLY_YOURS
}

// What a cell is painted in.
//
// The session cell wears the challenge's own colour rather than a stop off the game
// spectrum: the rest of the row is the app's scale, and this one cell is about the thing
// the run belongs to. `challengeInk` is the shade of that colour which carries a word.
export const cellColor = (key: BestKey, mode: ModeId): string =>
  (key === 'session' || key === 'last') && isChallenge(mode)
    ? challengeInk(gradientOf(mode)[1])
    : BEST_COLORS[key]
