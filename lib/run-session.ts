// A run's **session**, as the screens around the run read it: the standings the score bar
// draws, the targets announcements measure against, the medal it finished on, and the
// two halves a saved run keeps.

import type { SessionBests } from '@/components/game/best-scores-line'
import type { PeriodBoard } from '@/hooks/use-board'
import type { SessionRun } from '@/lib/announcement-run'
import { sessionMedal, type BoardMedal } from '@/lib/board-medals'
import type { LeaderboardRow } from '@/lib/leaderboard'
import type { LocalScore } from '@/lib/local-scores'
import type { RunSession, SavedRun } from '@/lib/saved-run'
import {
  deviceBestOf,
  sessionTargetsOf,
  type SessionTargets,
} from '@/lib/session-announcements'
import type { PreviousWinner } from '@/lib/session-board'
import type { SessionFigures } from '@/lib/session-order'
import type { Measure } from '@/modes'

// What the bar measures a session run by, or null for an ordinary run.
export const sessionRunOf = (
  targets: SessionTargets | null,
  figures: SessionFigures,
  userId: string | null,
): SessionRun | null => (targets === null ? null : { targets, figures, userId })

// The standings a run belongs to, as the score bar wants them — or null for an ordinary
// run, and for a session run whose two halves are not both in hand yet.
//
// Both are needed: the close time came off the card the run was started from, the
// standings off the server. Until the read lands there is nothing honest to draw, and the
// strip falls back to its blank height rather than showing a session whose best is a
// guess.
//
// On a race the two figures are times rather than scores, and on a hits session they are
// hits. The board's rows come ordered by the session's **measure**, so the top row is
// still the record — it is only which column of it the strip reads that changes.
//
// The figure each measure other than the score reads off a run. The score is read off
// the board itself, which already knows the record and the player's own best.
const RANKED_OF = {
  time: (run) => run.timeMs ?? 0,
  hits: (run) => run.hits,
} as const satisfies Record<Exclude<Measure, 'score'>, (run: SessionFigures) => number>

const figuresOf = (row: LeaderboardRow): SessionFigures => ({
  score: row.best_score,
  hits: row.hits,
  timeMs: row.time_ms ?? null,
})

export const sessionBestsOf = (
  id: string | null,
  closesAt: number | null,
  board: PeriodBoard | null,
  measure: Measure,
  userId: string | null,
  previous: PreviousWinner | null,
): SessionBests | null => {
  if (id === null || closesAt === null || board === null) return null
  const mine = board.rows.find((row) => row.user_id === userId)
  const top = board.rows[0]
  const ranked = measure === 'score' ? null : RANKED_OF[measure]
  const figure = (row: LeaderboardRow | undefined) =>
    row === undefined || ranked === null ? 0 : ranked(figuresOf(row))
  return {
    measure,
    best: ranked === null ? (board.record ?? 0) : figure(top),
    holder: board.recordHolder,
    mine: board.recordIsMine,
    myBest: ranked === null ? board.myBest : figure(mine),
    // Left off rather than drawn as 0.0 where a race's winner has no time — an untimed
    // row from an older build, which would read as a record nobody could beat.
    last:
      previous === null || (measure === 'time' && previous.timeMs === null)
        ? null
        : {
            holder: previous,
            value: ranked === null ? previous.score : ranked(previous),
            mine: previous.userId === userId,
          },
    closesAt,
  }
}

// The instant a run's **session** shuts, for the two screens a stopped run lands on, or
// null for an ordinary run.
//
// Out here beside `sessionBestsOf` rather than inline at the two call sites, and for the
// same reason that one is: both halves have to be in hand for the answer to mean anything
// — a close time left over from a finished run is a figure nothing should draw — and a
// screen component is not the place to keep remembering that.
export const sessionClockOf = (
  sessionId: string | null,
  closesAt: number | null,
): number | null => (sessionId === null ? null : closesAt)

// The run's session as the saved run keeps it, or null for an ordinary run — both halves
// or neither, for the reason `sessionBestsOf` gives.
export const savedSessionOf = (
  sessionId: string | null,
  closesAt: number | null,
): RunSession | null =>
  sessionId === null || closesAt === null ? null : { id: sessionId, closesAt }

// The other way: what a restored run puts back, null on both halves for an ordinary run.
export const restoredSessionOf = (
  saved: SavedRun,
): { id: string | null; closesAt: number | null } => ({
  id: saved.session?.id ?? null,
  closesAt: saved.session?.closesAt ?? null,
})

// Where a finished run came on its session, as a medal — asked once, at game over, of the
// board already held for the score bar, and handed to both the title and the screen
// under it so the two cannot answer differently. Empty for an ordinary run, and for a
// session run still being played, which the caller says by passing no session.
export const runSessionMedalsOf = (
  session: string | null,
  board: PeriodBoard | null,
  figures: SessionFigures,
  measure: Measure,
  userId: string | null,
): BoardMedal[] =>
  session === null ? [] : sessionMedal(board?.rows ?? [], figures, measure, userId)

// A session run's targets, once its standings have been read. A read that failed is not
// one: its empty rows would freeze as "nobody leads, and we can't say it's empty", and a
// frozen target is never replaced, so the run would go the whole way in silence. Null
// waits for the next good read, and `stepRun` catches up on the score reached by then.
export const sessionTargetsFor = (
  runSession: string | null,
  board: PeriodBoard | null,
  measure: Measure,
  userId: string | null,
  localScores: LocalScore[],
): SessionTargets | null =>
  runSession === null || board?.error !== null
    ? null
    : sessionTargetsOf({
        measure,
        rows: board.rows,
        empty: board.empty,
        userId,
        device: deviceBestOf(localScores, runSession, measure),
      })
