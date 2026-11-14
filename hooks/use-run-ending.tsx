import { isOneOf } from 'narrowland'
import { useEffect, useRef, useState } from 'react'

import type { ScreenAsks } from '@/hooks/use-launch-asks'
import type { ScreenAccount } from '@/hooks/use-player-account'
import type { ScreenAnnouncements } from '@/hooks/use-run-announcements'
import type { ScreenBoards } from '@/hooks/use-run-boards'
import type { ScreenControl } from '@/hooks/use-run-control'
import { track } from '@/lib/analytics'
import type { AnalyticsEvents } from '@/lib/analytics-events'
import { type Period } from '@/lib/announcements'
import { currentBoardMedals } from '@/lib/board-medals'
import { recordScreen, type RecordScreen } from '@/lib/champions'
import { runChallenge } from '@/lib/next-challenge'
import { heldPeriods, medalPeriods } from '@/lib/record-medals'
import { countRun } from '@/lib/run-submission'
import { runKindOf } from '@/lib/run-totals'
import { claimedTime } from '@/machines/game'
import { SCORED_MODES } from '@/modes'

// How a run ends: the medals, the record screen and the podium it lands on, the score and
// counters posted once, and every way of ending one early.
export function useRunEnding({
  control,
  account,
  asks,
  boards,
  announcements,
}: {
  control: ScreenControl
  account: ScreenAccount
  asks: ScreenAsks
  boards: ScreenBoards
  announcements: ScreenAnnouncements
}) {
  const {
    accSum,
    difficulty,
    elapsedMs,
    hits,
    isGameOver,
    maxStreak,
    mode,
    rules,
    runId,
    runSession,
    spdSum,
    state,
    strikes,
  } = control
  const { isReady, nickname, userId } = account
  const { setShowNicknameModal, submitScore } = asks
  const {
    bestEver,
    bestToday,
    bestWeek,
    board,
    champions,
    refreshBoard,
    refreshSessionBoard,
  } = boards
  const { avgAccuracy, avgSpeed, crossed } = announcements
  // The boards the run ended on top of, latched on the game-over edge below. What the
  // bar announced is the starting point — by game over the player's own score is the
  // record, so asking the board what this run took would say yes to every run — and
  // each claim is then checked against the board as it stands, so a rival who went past
  // mid-run takes the medal with them. Latched rather than derived because the title
  // tier reads it while flying up from the board, and a medal that moved under it would
  // change the letters mid-flight.
  const [runMedals, setRunMedals] = useState<readonly Period[]>([])
  // Latched beside the medals and for the same reason: the title reads it while flying
  // up from the board, and a rival taking the other mode's Extreme board mid-screen
  // must not turn a crown into a bird under the player.
  const [runScreen, setRunScreen] = useState<RecordScreen>('plain')
  // Whether this run landed on the podium at all — gold, silver or bronze, on any
  // period — latched for the same reason as the two above. A superset of `runMedals`,
  // which only tracks the top spot: this is what keeps a low-scoring run that still
  // took second or third off the title's cold/plain fallbacks.
  const [runPodium, setRunPodium] = useState(false)

  // Which of a title tier's three lines this run gets. Drawn once per game over, not
  // per render: the title flies up from the board and hands off to the overlay, so a
  // roll taken during render would change the letters mid-flight.
  const [titleRoll, setTitleRoll] = useState(Math.random())

  // Trigger score submission on each game-over transition.
  const prevIsGameOverRef = useRef(false)
  useEffect(() => {
    if (isGameOver === prevIsGameOverRef.current) return
    prevIsGameOverRef.current = isGameOver
    if (isGameOver) {
      setTitleRoll(Math.random())
      // The boards have been kept live all run by Realtime, so what they hold now is
      // what a rival left behind if they passed us while we were playing.
      const taken = heldPeriods(medalPeriods(crossed), state.context.score, {
        today: bestToday,
        week: bestWeek,
        ever: bestEver,
      })
      const screen = isOneOf(mode, SCORED_MODES)
        ? recordScreen({
            record: taken[0] ?? null,
            mode,
            difficulty,
            userId,
            champions,
          })
        : 'plain'
      setRunMedals(taken)
      setRunScreen(screen)
      setRunPodium(
        isOneOf(mode, SCORED_MODES) &&
          currentBoardMedals(board, state.context.score, userId).length > 0,
      )
      track('run_finished', {
        mode,
        difficulty,
        score: state.context.score,
        hits: state.context.hits,
        strikes: state.context.strikes,
        records: taken,
        screen,
        personal_best: crossed.includes('record'),
      })
      // Mirrors the game-over screen's own decision — see game-over-overlay.tsx, which
      // computes the same offer from the same run, up or down. Offered here, accepted
      // in onChallenge.
      const offer = runChallenge(
        mode,
        difficulty,
        state.context.hits,
        state.context.strikes,
      )
      if (offer !== null) {
        track('challenge_offered', {
          mode,
          difficulty,
          to_mode: offer.mode,
          to: offer.difficulty,
        })
      }
    }
    // Refresh on both edges of game over so other players' runs appear. Our own score
    // no longer depends on this landing: it is recorded on the device as it is
    // submitted, and the board store folds that in without asking the server.
    void refreshBoard()
    if (isGameOver && (isOneOf(mode, SCORED_MODES) || runSession !== null)) {
      void submitScore(
        mode,
        rules.difficulty,
        state.context.score,
        state.context.hits,
        runSession,
        // The run is over, so `elapsedMs` has stopped moving — see `stopClock`.
        // `submitScore` keeps it only where the measure is the clock; the mid-run
        // record post above sends none, a run still being played having no time to
        // claim. Nor does a drilled run its window shut on before the ninth target
        // fell: only a finished race has a time, and without one a race posts nothing.
        claimedTime(state.context, rules) ?? undefined,
        // Then the standings again, so the table on the game-over screen has this run on
        // it. Read before the write landed, it showed the session as it was before the
        // run — empty, on a session nobody else had played yet. Asks nothing of the
        // server on an ordinary run, which has no session to read.
      ).then(refreshSessionBoard)
      if (isReady && !nickname && state.context.score > 0) setShowNicknameModal(true)
    }
  }, [
    isGameOver,
    isReady,
    nickname,
    mode,
    difficulty,
    state.context.score,
    state.context.hits,
    state.context.strikes,
    crossed,
    bestToday,
    bestWeek,
    bestEver,
    submitScore,
    refreshBoard,
  ])

  // The post that closes the run. Its counters have been going up with every board
  // record it set (see `onBoardRecord`); this is the last word on them, and the server
  // takes nothing under this run's name afterwards.
  //
  // The ref is what keeps it to one: this effect's inputs settle over a few renders
  // after game over, and only the first of them is the run. A repeat would be harmless —
  // the server would find the run already closed and do nothing — but it is a round trip
  // to be told so.
  //
  // A run played in a session closes its receipt the same way, which is what puts a
  // challenge run on the analytics screen — see `runKindOf`.
  const countedRunRef = useRef(false)
  useEffect(() => {
    if (!isGameOver) {
      countedRunRef.current = false
      return
    }
    const counted = runKindOf(mode, rules.difficulty, runSession)
    if (countedRunRef.current || counted === null) return
    countedRunRef.current = true
    void countRun(userId, {
      ...counted,
      runId,
      score: state.context.score,
      hits,
      accSum,
      spdSum,
      elapsedMs,
      final: true,
    })
  }, [
    isGameOver,
    mode,
    rules.difficulty,
    runSession,
    state.context.score,
    hits,
    accSum,
    spdSum,
    elapsedMs,
    runId,
    userId,
  ])

  // Ending a run yourself from the pause menu still counts: submit the score and ask
  // for a nickname exactly as running out of lives does. The game-over effect below
  // only fires on the gameOver transition, so without this the run would be lost.
  const endRunEarly = (reason: AnalyticsEvents['run_ended']['reason']) => {
    // Ahead of the scored-mode guard below, and on purpose: a Trainee run the player
    // walked out of is still a run that ended, and the question this answers — how many
    // runs are abandoned rather than played out — is not a question about leaderboards.
    //
    // The pause screen's callers find the stretch already banked, with `playingSince`
    // cleared; a hold on the targets area ends a run that is still being played, so its
    // open stretch is added by hand the way the machine's `stopClock` would.
    const now = Date.now()
    const ranMs = elapsedMs + now - (state.context.playingSince ?? now)
    track('run_ended', {
      mode,
      difficulty,
      reason,
      score: state.context.score,
      hits: state.context.hits,
      strikes,
      elapsed_ms: ranMs,
      accuracy: avgAccuracy,
      speed: avgSpeed,
      max_streak: maxStreak,
    })
    // A session run leaves here too, even though its mode keeps no board: the bar below
    // is about `scores`, and a session's standings are not that table. Without this, END
    // RUN and RESTART RUN were the two ways to finish a challenge run that threw the
    // score away entirely — not posted, and not even queued on the device.
    const onBoard = isOneOf(mode, SCORED_MODES)
    if (!onBoard && runSession === null) return
    const { score, hits } = state.context
    // Counted before the score guard below: a run that scored nothing is still a run
    // the player played, and "how many runs" is not "how many went well".
    //
    // A board run moves `player_totals`, which is keyed by mode × difficulty — a board.
    // A session run leaves only a receipt, for the analytics: its figures belong to the
    // session it was played in and reach the player's fortune from there. `runKindOf`
    // tells the two apart, and the type keeps the second away from the first's counters.
    const counted = runKindOf(mode, rules.difficulty, runSession)
    if (counted !== null && !countedRunRef.current) {
      countedRunRef.current = true
      void countRun(userId, {
        ...counted,
        runId,
        score,
        hits,
        accSum,
        spdSum,
        elapsedMs: ranMs,
        final: true,
      })
    }
    if (score <= 0) return
    // No time goes up with it. A run left before its drill was spent did not finish the
    // race, and the clock it stopped on is not a time it set: one hit and END RUN posted
    // 3.1″, which beat every run that went the distance. Without one, `submitScore`
    // drops a race's post entirely and keeps a score-measured session's as it was.
    void submitScore(mode, rules.difficulty, score, hits, runSession)
    void refreshBoard()
    if (isReady && !nickname) setShowNicknameModal(true)
  }

  return { endRunEarly, runMedals, runPodium, runScreen, titleRoll }
}

export type ScreenEnding = ReturnType<typeof useRunEnding>
