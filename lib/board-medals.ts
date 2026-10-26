import { PERIODS, type Period } from '@/lib/announcements'
import { medalRank } from '@/lib/medals'
import { runBeats, type SessionFigures } from '@/lib/session-order'
import type { Measure } from '@/modes'

// A place the run earned on one period of a board — or, with no period, on a **session**,
// which has exactly one set of standings and so nothing to distinguish them from.
//
// `null` rather than a fourth period: a session is not a longer or shorter window on the
// same board, it is its own window and the only one it has. Adding `'session'` to
// `Period` would have put it in every table keyed by period — the board tabs, the medal
// collapse, the reigns — none of which has anything to say about it.
export type BoardMedal = { period: Period | null; rank: 1 | 2 | 3 }

// Where a run lands on the podium, or null for off it.
type Place = 1 | 2 | 3 | null

// One row of a board, as the medal count sees it.
export type BoardRow = { score: number; isMine: boolean }

// The medal this run puts on the board, or null for none.
//
// Two things have to be true at once, and they are the whole rule: the run has to be
// what the player now shows on that board, and that row has to land on the podium. A
// medal the player keeps but the run did not earn is not this run's, and a place the
// run would have taken but does not hold is not on the board to see.
//
// So a 4000 behind one's own 5000 is nothing: the board still shows the 5000 and the
// gold that comes with it, and the run changed neither. Rows below the player's own are
// counted out for the same reason — beating a score you already beat wins nothing twice.
//
// `rows` is the board's top five, which is all a podium needs: anything past third is no
// medal either way.
export function runMedal(score: number, rows: readonly BoardRow[]): Place {
  return placeAmong(
    rows.map((row) => ({ isMine: row.isMine, above: row.score > score })),
    score,
  )
}

// The rule itself, for any standings, given which rows stand above the run: on a board the
// higher score, on a session whatever its **measure** orders by. One copy, so the board
// and the session cannot drift apart on it.
//
// `score` is asked separately because a run with nothing on it takes no medal however it
// is ranked — see `medalRank`.
function placeAmong(
  rows: readonly { isMine: boolean; above: boolean }[],
  score: number,
): Place {
  // An older, better run of the player's own is what the standings are showing.
  if (rows.some((row) => row.isMine && row.above)) return null
  const ahead = rows.filter((row) => !row.isMine && row.above).length
  return medalRank(ahead + 1, score)
}

// What the run is worth across the three periods of one board, with the periods that
// say nothing new dropped.
//
// A place on a longer board implies the same place on every shorter one: leading all
// time means leading the week and the day too, because the score doing the leading sits
// on those boards as well. So gold, gold, gold is one fact told three times, and only
// EVER is worth the room.
//
// Different metals are different facts and all survive: first today but third all time
// says both that the day is yours and that the game is not, which is two things a player
// wants to know. PERIODS is ordered longest first, so each medal is only ever compared
// with the longer one that would imply it.
export function boardMedals(ranks: Record<Period, 1 | 2 | 3 | null>): BoardMedal[] {
  const kept: BoardMedal[] = []
  for (const period of PERIODS) {
    const rank = ranks[period]
    if (rank === null) continue
    // Only against the last kept: rank can only improve as the window shortens, so a
    // medal that matches any longer period matches the nearest one.
    if (kept.at(-1)?.rank === rank) continue
    kept.push({ period, rank })
  }
  return kept
}

// One period of a board, as much of it as a medal count needs — the same shape
// `PeriodBoard` (hooks/use-board.ts) already has on hand, spelled out here instead of
// imported so this file keeps its no-React-dependency rule.
type MedalBoardPeriod = { rows: readonly { best_score: number; user_id: string }[] }

// What a run is worth right now across all three periods of one board — the same
// question `runMedal` answers for one period, asked of the live board a game-over
// screen already has in context. Shared so the badges on screen and anything that
// reacts to "did this run medal at all" can never read two different answers to the
// same question.
export function currentBoardMedals(
  board: { today: MedalBoardPeriod; week: MedalBoardPeriod; forever: MedalBoardPeriod },
  score: number,
  userId: string | null,
): BoardMedal[] {
  const earned = (period: MedalBoardPeriod) =>
    runMedal(
      score,
      period.rows.map((row) => ({
        score: row.best_score,
        isMine: userId !== null && row.user_id === userId,
      })),
    )
  return boardMedals({
    ever: earned(board.forever),
    week: earned(board.week),
    today: earned(board.today),
  })
}

// Where a run came on its session's standings, as a medal with no period beside it.
//
// A list rather than a single value so the caller can hand it straight to `BoardMedals`
// alongside the board case, and empty rather than null for no medal, which is the same
// shape `boardMedals` returns when a run earned nothing.
//
// The rule is `runMedal`'s — the run has to be what the standings now show, and that
// row has to land on the podium — asked by the session's **measure** rather than by the
// score: a race is placed by its clock and a NO SLIP session by its hits, so a run first
// on either can score less than the rows below it. See `runBeats`, which the device also
// keeps its own best by, so the medal and the row it is about never disagree.
//
// A run with nothing on it — no point and no hit — takes no medal, as on a board.
export function sessionMedal(
  rows: readonly {
    best_score: number
    hits: number
    time_ms?: number | null
    user_id: string
  }[],
  run: SessionFigures,
  measure: Measure,
  userId: string | null,
): BoardMedal[] {
  const rank = placeAmong(
    rows.map((row) => ({
      isMine: userId !== null && row.user_id === userId,
      above: runBeats(
        measure,
        { score: row.best_score, hits: row.hits, timeMs: row.time_ms ?? null },
        run,
      ),
    })),
    run.score,
  )
  return rank === null ? [] : [{ period: null, rank }]
}
