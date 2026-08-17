import { isOneOf } from 'narrowland'

import {
  DIFFICULTY_ORDER,
  SCORED_MODES,
  type Difficulty,
  type ScoredMode,
} from '@/machines/game'

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
