import { useMemo } from 'react'

import { useBoard } from '@/hooks/use-board'
import { useChampions } from '@/hooks/use-champions'
import { useLocalScores } from '@/hooks/use-local-scores'
import type { ScreenAccount } from '@/hooks/use-player-account'
import type { ScreenControl } from '@/hooks/use-run-control'
import { useRunRival } from '@/hooks/use-run-rival'
import { usePreviousWinner, useSessionBoard } from '@/hooks/use-session-card'
import { type Leaders } from '@/lib/announcements'
import { leaderOf } from '@/lib/leaderboard'
import { runSessionMedalsOf, sessionTargetsFor } from '@/lib/run-session'

// The boards a run is measured against: the board store, the run's session standings,
// last airing's winner, the champions, the leaders and the rival — and the targets a
// session run's announcements are frozen against.
export function useRunBoards({
  control,
  account,
}: {
  control: ScreenControl
  account: ScreenAccount
}) {
  const {
    difficulty,
    isGameOver,
    isPaused,
    isPlaying,
    mode,
    rules,
    runFigures,
    runSession,
    state,
  } = control
  const { shownFeatures, userId } = account
  // The one board store. Every surface that shows a score reads it — the strip above
  // the top bar, the intro, the pause screen and the game over screen — so they cannot
  // answer the same question differently. Trainee has no board and it stays quiet.
  const board = useBoard(mode, difficulty, userId)
  // The run's session standings, for the score bar's SESSION cell. Null for an ordinary
  // run, which `useSessionBoard` answers without asking the server.
  //
  // The one read of them: the strip, the pause screen and game over all draw this, so the
  // place in the title and the table under it cannot disagree. Read again as the run
  // pauses and resumes, and once the final score has landed.
  const { board: runSessionBoard, refresh: refreshSessionBoard } = useSessionBoard(
    runSession,
    userId,
    isPaused,
  )
  const runSessionMedals = runSessionMedalsOf(
    isGameOver ? runSession : null,
    runSessionBoard,
    runFigures,
    rules.scoring.measure,
    userId,
  )
  // Who won this challenge the last time it was aired, for the strip's third cell.
  const previousWinner = usePreviousWinner(runSession, isPaused)
  // Who holds each mode's Extreme all-time board, and who took the last challenge —
  // read wherever a name is drawn, and by the game-over screen to tell a reign from a
  // single record. The id is passed so the dev sidebar can pin the phoenix on this player.
  const champions = useChampions(userId, shownFeatures.has('challenges'))
  const refreshBoard = board.refresh
  const bestToday = board.today.record
  const bestWeek = board.week.record
  const bestEver = board.forever.record
  // Memoised on the fetched rows so the rival watcher only wakes when a fetch actually
  // lands, not on every render of the game screen.
  const leaders: Leaders = useMemo(
    () => ({
      today: leaderOf(board.today.rows),
      week: leaderOf(board.week.rows),
      ever: leaderOf(board.forever.rows),
    }),
    [board.today.rows, board.week.rows, board.forever.rows],
  )

  const inRun = isPlaying || isPaused
  const measure = rules.scoring.measure
  const rival = useRunRival({
    inRun,
    runSession,
    mode,
    difficulty,
    userId,
    leaders,
    sessionBoard: runSessionBoard,
    measure,
    figures: runFigures,
    runSeq: state.context.runSeq,
  })
  // What a session run is measured against on the bar: the session board, by the
  // session's **measure**, with the player's own row reconciled against what the device
  // holds for the session. Null on an ordinary run, and while the standings are still
  // being read — `ready` below waits for them, so a null here is never frozen.
  const localScores = useLocalScores()
  const sessionTargets = useMemo(
    () => sessionTargetsFor(runSession, runSessionBoard, measure, userId, localScores),
    [runSession, runSessionBoard, measure, userId, localScores],
  )

  return {
    bestEver,
    bestToday,
    bestWeek,
    board,
    champions,
    inRun,
    previousWinner,
    refreshBoard,
    refreshSessionBoard,
    rival,
    runSessionBoard,
    runSessionMedals,
    sessionTargets,
  }
}

export type ScreenBoards = ReturnType<typeof useRunBoards>
