// The run a message was written from, as plain JSON data.
//
// A report sent from the pause screen is the one case where "it did this" can be checked
// against what the machine actually held — the grid, the targets in flight, the lives,
// the streak, the clock. So the whole of the machine's context goes with the message,
// plus the state it was sitting in. Nothing here is anything the player was not looking
// at while they wrote it; it is the context the dialog already names, at full resolution.
//
// Pure, and in its own file for the same reason `feedback-outcome.ts` is: the module that
// sends reaches for `lib/supabase`, which pulls in AsyncStorage, which does not load under
// vitest's node environment.

// `JSON.stringify` writes a non-finite number as `null`, and trainee's lives are
// Infinity — a snapshot reading `"lives": null` would say the opposite of what it means.
// Those are written as their own names instead.
const readable = (_key: string, value: unknown): unknown =>
  typeof value === 'number' && !Number.isFinite(value) ? String(value) : value

// A ceiling on what one row may carry. The machine's context is bounded — nine cells,
// four targets at the very most, one hit batch — so a real snapshot is a couple of
// kilobytes and this never fires. It is here so that a context which one day grows a list
// nobody trims cannot quietly turn every report into a large row.
export const MAX_STATE_LENGTH = 8000

// The snapshot for one paused run, or null when there is nothing worth attaching.
//
// Written out and read back rather than handed over as it stands: the round trip is what
// applies `readable` and drops anything JSON cannot hold, so what the column receives is
// exactly what was measured against the ceiling. The result is opaque — nothing reads it
// again on this side of the wire, it is only carried to the row.
//
// Null rather than a throw at every turn: the message is the point, and a report that
// arrives without its snapshot is worth far more than one that does not arrive.
export function gameSnapshot(
  // The machine's state value: a plain name for this machine, and the nested shape
  // XState would report if it ever grew one. Neither is read here — both are written
  // down exactly as they come.
  state: string | Readonly<Record<string, unknown>>,
  context: Readonly<Record<string, unknown>>,
): unknown {
  try {
    const json = JSON.stringify({ state, context }, readable)
    if (json.length > MAX_STATE_LENGTH) return null
    const plain: unknown = JSON.parse(json)
    return plain
  } catch {
    return null
  }
}
