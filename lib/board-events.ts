import type { Difficulty, Mode } from '@/machines/game'

// Supabase `postgres_changes` accepts exactly ONE filter expression. Two conditions
// joined with `&` — `mode=eq.speed&difficulty=eq.hard` — are taken as a single literal
// that matches nothing, and the channel still reports SUBSCRIBED, so the mistake is
// invisible: the subscription simply never fires.
//
// So the mode is filtered server-side, which is the more selective of the two, and the
// difficulty is checked here against the row the event carried.
export const boardFilter = (mode: Mode): string => `mode=eq.${mode}`

type EventRow = { difficulty?: unknown }

// Whether a score change belongs to the board being watched. DELETE carries the row in
// `old` rather than `new`; an event with neither is not something we can attribute, so
// it counts as a miss rather than triggering a refetch.
export function isBoardEvent(
  payload: { new?: EventRow; old?: EventRow },
  difficulty: Difficulty,
): boolean {
  const row = payload.new ?? payload.old
  return row?.difficulty === difficulty
}
