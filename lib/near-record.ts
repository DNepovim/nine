// Which of the four numbers in the best-scores line a run is closing in on.
export type NearRecordKey = 'you' | 'today' | 'week' | 'ever'

// How close counts as close — a fraction of the bar itself, so the nudge means the
// same thing on every board size instead of being a fixed number that is trivial to
// clear on Extreme and out of reach on Easy.
const NEAR_FRACTION = 0.05

// Biggest claim first: a tie between two boards this close together is rare, and when
// it happens the bigger one is the more interesting thing to be closing in on.
const ORDER: readonly NearRecordKey[] = ['ever', 'week', 'today', 'you']

// The record this score is closest to clearing, or null when nothing is close enough
// to be worth a nudge. `bars` takes the exact numbers the best-scores line already
// shows — the tease has to point at something the player can see in the same row, not
// a number computed some other way that might not match it.
export function nearestRecord(
  score: number,
  bars: Record<NearRecordKey, number | null>,
): NearRecordKey | null {
  let best: { key: NearRecordKey; gap: number } | null = null
  for (const key of ORDER) {
    const bar = bars[key]
    // No bar, or nothing there yet to chase — a first score sets a record rather than
    // closing in on one.
    if (bar === null || bar <= 0) continue
    const gap = bar - score
    // Already cleared, or still too far off to call close.
    if (gap <= 0 || gap > bar * NEAR_FRACTION) continue
    if (best === null || gap < best.gap) best = { key, gap }
  }
  return best?.key ?? null
}
