import type { Measure } from '@/modes'

// Which of two runs a session's standings put first, per **measure** — the one rule the
// device asks in two places: which run it keeps for a slot (`beats` in
// lib/local-scores.ts) and where a finished run lands on the standings (`sessionMedal` in
// lib/board-medals.ts). They used to answer it separately, and the medal kept asking by
// score after the standings had learnt to order a race by its clock and a NO SLIP session
// by its hits — so a run first on the standings could be told it took silver.
//
// The server orders by the same rules — `prevent_session_downgrade`, `session_board` and
// the card's leader in `…_session_hits_measure.sql` — and the two must not disagree, or
// the device shows one best and the standings another.
//
// **Strictly** better: a run that only equals one is not ahead of it. That is what lets a
// tie go to the run already standing, here and on the server alike.
export type SessionFigures = { score: number; hits: number; timeMs: number | null }

const BEATS = {
  score: (run, held) => run.score > held.score,
  // A race is won by a run that finished, then by the most hits, then by the clock — and
  // only a finished run has a time. Two untimed runs (a race posted by a build older than
  // the clock) fall back to the score, the only figure both of them have.
  time: (run, held) => {
    if (run.timeMs === null && held.timeMs === null) return run.score > held.score
    if (run.timeMs === null) return false
    if (held.timeMs === null) return true
    if (run.hits !== held.hits) return run.hits > held.hits
    return run.timeMs < held.timeMs
  },
  // A run is as good as it was long, and two as long are told apart by the score.
  hits: (run, held) => {
    if (run.hits !== held.hits) return run.hits > held.hits
    return run.score > held.score
  },
} as const satisfies Record<
  Measure,
  (run: SessionFigures, held: SessionFigures) => boolean
>

export const runBeats = (
  measure: Measure,
  run: SessionFigures,
  held: SessionFigures,
): boolean => BEATS[measure](run, held)
