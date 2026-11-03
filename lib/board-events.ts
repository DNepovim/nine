import { isOneOf } from 'narrowland'

import { DIFFICULTY_ORDER, SCORED_MODES, type Difficulty, type ScoredMode } from '@/modes'

// Which board a score row belongs to — one mode × difficulty pairing, one leaderboard.
export type BoardRef = { mode: ScoredMode; difficulty: Difficulty }

type EventRow = { mode?: unknown; difficulty?: unknown }

// Which board a Realtime score event belongs to, or null when it cannot be attributed.
//
// The columns arrive as plain JSON, so they are narrowed back to the unions before
// anything downstream compares them — a row naming a board this build does not know
// about is unattributable rather than a board of its own. DELETE carries the row in
// `old` rather than `new`.
//
// Being unattributable is not the same as being irrelevant: the caller treats null as
// "something moved and we cannot say where", which is the safe reading.
export function boardOf(payload: { new?: EventRow; old?: EventRow }): BoardRef | null {
  const row = payload.new ?? payload.old
  if (row === undefined) return null
  const { mode, difficulty } = row
  if (!isOneOf(mode, SCORED_MODES)) return null
  if (!isOneOf(difficulty, DIFFICULTY_ORDER)) return null
  return { mode, difficulty }
}

// Which **session** a Realtime `session_scores` event belongs to, or null when the row
// carries none we can read — which the listener takes as "any session may have moved".
//
// Asked of each side in turn rather than of whichever is present: Realtime sends a
// DELETE's `new` as an empty object, not as nothing, and the id is in `old`.
export function sessionOf(payload: {
  new?: { session_id?: unknown }
  old?: { session_id?: unknown }
}): string | null {
  const id = [payload.new?.session_id, payload.old?.session_id].find(
    (side) => typeof side === 'string',
  )
  return typeof id === 'string' ? id : null
}
