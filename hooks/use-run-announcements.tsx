import { useEffect, useRef, useState } from 'react'

import type { AchievementId } from '@/constants/achievements'
import { useAchievementQueue, useAchievements } from '@/hooks/use-achievements'
import { useAnnouncements } from '@/hooks/use-announcements'
import { useHitCelebration } from '@/hooks/use-hit-celebration'
import type { ScreenAsks } from '@/hooks/use-launch-asks'
import { useLostMedals } from '@/hooks/use-lost-medals'
import { useMedalHistory } from '@/hooks/use-medal-history'
import { useMyMedals } from '@/hooks/use-my-medals'
import { useOnline } from '@/hooks/use-online'
import type { ScreenAccount } from '@/hooks/use-player-account'
import type { ScreenBoards } from '@/hooks/use-run-boards'
import type { ScreenControl } from '@/hooks/use-run-control'
import type { ScreenSession } from '@/hooks/use-run-session'
import type { ScreenDialogs } from '@/hooks/use-screen-dialogs'
import { useSessionPlaces } from '@/hooks/use-session-places'
import { useStepUp } from '@/hooks/use-step-up'
import { useTraineeCoach } from '@/hooks/use-trainee-coach'
import { track } from '@/lib/analytics'
import { personalBar } from '@/lib/announcements'
import { boardTargetsOf } from '@/lib/board-targets'
import { holdsBothBoards } from '@/lib/champions'
import { averageOf } from '@/lib/run-average'
import { sessionRunOf } from '@/lib/run-session'
import { countRun } from '@/lib/run-submission'
import { runKindOf } from '@/lib/run-totals'
import { announcementsReady } from '@/lib/session-announcements'
import { STEP_UP_BOARD } from '@/lib/step-up'
import { bestOn, type GameSend } from '@/machines/game'
import { DIFFICULTY_ORDER, SCORED_MODES } from '@/modes'

// What a run says while it is played: the hit celebration, the step-up offer, the trainee
// coach, the announcement bar and the achievements — and the medals and places they read.
export function useRunAnnouncements({
  control,
  session,
  dialogs,
  account,
  asks,
  boards,
}: {
  control: ScreenControl
  session: ScreenSession
  dialogs: ScreenDialogs
  account: ScreenAccount
  asks: ScreenAsks
  boards: ScreenBoards
}) {
  const {
    accSum,
    actor,
    difficulty,
    elapsedMs,
    grid,
    hitBatch,
    hits,
    isGameOver,
    lives,
    maxStreak,
    mode,
    rules,
    runFigures,
    runId,
    runSession,
    send,
    spdSum,
    state,
    stats,
    strikes,
    targets,
    tutorial,
  } = control
  const { placesAsked } = session
  const { feedbackAnswered, howToPlay, welcome } = dialogs
  const { userId } = account
  const { submitScore } = asks
  const { board, champions, inRun, rival, sessionTargets } = boards
  const celebration = useHitCelebration(inRun, rules.capabilities.coached, hitBatch)

  // Trainee's invitation to a scored board. Offered only to a player who has never
  // posted one: the point is introducing the boards to someone who has not found them.
  const playedScored = SCORED_MODES.some((scored) =>
    DIFFICULTY_ORDER.some((level) => bestOn(stats, scored, level).score > 0),
  )
  const stepUp = useStepUp({
    inRun,
    // Not during the tutorial, which makes the same offer itself the moment the lesson
    // runs out — see `useTaughtOffer` below. Two invitations to the one board, one of
    // them arriving while a script is still talking, is the nagging the offer is
    // rationed to once a run to avoid.
    coached: rules.capabilities.coached && !tutorial,
    batch: hitBatch,
    hits,
    playedScored,
    fromWelcome: welcome.welcomed,
  })
  // Which achievement the announcement bar was tapped for, or null. The run is paused
  // behind the card rather than running on under it: an achievement is worth stopping for,
  // and reading one while targets expire is how a player loses a life to their own
  // curiosity. Dismissing leaves them on the pause screen, which carries the same row.
  const [askedAchievement, setAskedAchievement] = useState<AchievementId | null>(null)

  // Open while the transitional screen is up. The run is paused behind it rather than
  // abandoned, so backing out through the intro leaves nothing half-finished.
  const [stepUpOpen, setStepUpOpen] = useState(false)
  // The toast appearing is the offer being made; latched on its rising edge so the
  // withdraw-and-reoffer dance inside one run cannot double-count.
  const stepUpOfferedRef = useRef(false)
  useEffect(() => {
    const offered = stepUp.message !== null
    if (offered && !stepUpOfferedRef.current) {
      track('challenge_offered', {
        mode,
        difficulty,
        to_mode: STEP_UP_BOARD.mode,
        to: STEP_UP_BOARD.difficulty,
      })
    }
    stepUpOfferedRef.current = offered
  }, [stepUp.message, mode, difficulty])
  const coach = useTraineeCoach({
    inRun,
    rules,
    grid,
    targets,
    batch: hitBatch,
    // Muted for the whole of a tutorial run as well as while a celebration owns the line:
    // the stat block its line is drawn in is not on screen there, and a coach whose lines
    // go nowhere is a route solved on every press for nothing.
    muted: celebration.message !== null || tutorial,
  })

  const online = useOnline()

  // Read up here rather than beside the dial they are drawn next to: the achievements ask
  // for both, and a run's average is one of the few things a rule cannot re-derive.
  const avgAccuracy = averageOf(accSum, hits)
  const avgSpeed = averageOf(spdSum, hits)

  // Every board the player stands on. Read here rather than inside the intro screen,
  // which unmounts for the whole run — the achievements need it while one is going, and
  // one request answers for both.
  const { medals, standings, reigns, loaded: medalsLoaded } = useMyMedals(userId)

  // What rivals took off that line while nobody was looking. Held here rather than in the
  // intro screen, which unmounts for the whole run: the news has to survive being shown
  // once and not come back at the end of every run — see useLostMedals.
  const lostMedals = useLostMedals({ standings, loaded: medalsLoaded, userId })
  // What the week took off the player, for the list behind the medal line. Written by the
  // diff above at launch; read here so the list is standing by the time it is opened.
  const medalHistory = useMedalHistory()

  // Shared by the two hooks below, and declared above both because each needs something
  // from the other: the bar reads the queue, and the achievements read the bar's own
  // `crossed` to answer the board-shaped ones.
  const achievementQueue = useAchievementQueue(inRun)

  const { announcement, crossed } = useAnnouncements({
    inRun,
    // Nothing is frozen until the board has answered and the connection is good —
    // see announcementsReady. A run that started first gets its targets the moment
    // they land, and the score already reached is measured against them — which is
    // what a run begun on a cold start used to lose entirely.
    ready: announcementsReady(runSession, board.loaded, sessionTargets, online),
    score: state.context.score,
    runSeq: state.context.runSeq,
    // Measured against everything the app knows the player has scored here, not the
    // device's memory alone — the boards outlive a reinstall, a second device and a
    // hydrate that threw, and they are on this same screen. Trainee's entry stays at
    // zero on both sides, so this needs no special case to stay quiet there.
    //
    // None of it on a session run — see `boardTargetsOf`.
    ...boardTargetsOf(
      runSession,
      personalBar(bestOn(stats, mode, difficulty).score, board.forever.myBest),
      board,
    ),
    // The run's place on its session board, by the session's measure. `runFigures` is the
    // same three numbers game over places the run by, so the bar and the medal agree.
    session: sessionRunOf(sessionTargets, runFigures, userId),
    rival,
    achievements: achievementQueue.queue,
    onAchievementAnnounced: achievementQueue.announced,
    // Send the score the moment a board record falls rather than waiting for game
    // over: the write is what wakes every other player's bar, so delaying it is
    // what made rivals hear about a record minutes after it happened. The score
    // only climbs within a run, and the database refuses downgrades, so an early
    // write can never spoil the final one.
    onBoardRecord: () => {
      void submitScore(
        mode,
        rules.difficulty,
        state.context.score,
        state.context.hits,
        runSession,
      )
      // The counters go with it. A record is what takes a run's score public, and a run
      // whose score is on the board while its counters are still on the device is how a
      // profile came to show a best no career of its own could account for. Not final:
      // the run is still being played, and the post that closes it comes at game over.
      //
      // `elapsedMs` is short by the stretch being played right now — the machine only
      // banks it on leaving `playing` — which costs nothing, because the server keeps
      // the highest figure a run has ever posted and the last post carries the lot.
      //
      // A session run posts its receipt here too, beside its session score — see
      // `runKindOf`.
      const counted = runKindOf(mode, rules.difficulty, runSession)
      if (counted !== null) {
        void countRun(userId, {
          ...counted,
          runId,
          score: state.context.score,
          hits: state.context.hits,
          accSum: state.context.accSum,
          spdSum: state.context.spdSum,
          elapsedMs: state.context.elapsedMs,
          final: false,
        })
      }
    },
  })

  // What the player has earned, and what this run just added to it.
  //
  // Declared after the bar because it reads what the run has crossed: opening a day's
  // board and beating your own best are both things the bar has already worked out, and
  // working them out a second time here is how the two would come to disagree.
  const sessionPlaces = useSessionPlaces(userId, placesAsked)
  // The run a drag last moved more than one key in, landed a hit in, and landed a strike
  // in. Kept as the run's number rather than a flag, so the next run reads false without
  // anything having to clear it.
  const [sweptIn, setSweptIn] = useState({ gesture: -1, hit: -1, strike: -1 })
  // A press the dial says was part of a drag, sent and then read back: the machine
  // resolves a press synchronously, so a new hit batch straight after it is that press's.
  // Asked here rather than of `hitBatch` in an effect, since one drag can send several
  // presses inside a single render and only the last of them would still be on screen.
  const sendDialed = (
    event: Extract<Parameters<GameSend>[0], { type: 'PRESS' | 'SET_CELL' }>,
    sweep: boolean,
  ) => {
    const before = actor.getSnapshot().context.hitBatch.seq
    send(event)
    if (!sweep) return
    const { hitBatch: after, runSeq } = actor.getSnapshot().context
    if (after.seq === before) return
    setSweptIn((held) => ({
      ...held,
      hit: runSeq,
      strike: after.hits.some((hit) => hit.bonus) ? runSeq : held.strike,
    }))
  }
  const achievements = useAchievements({
    // Game over is part of the run here, unlike everywhere else `inRun` is used. The
    // pass that answers "did this run finish on nothing" happens at game over, and
    // `stepAchievements` drops any pass made outside a run — so a hook told the run was
    // already over threw away the one evaluation that could see `finished`.
    inRun: inRun || isGameOver,
    // Which run this is. `inRun` above cannot mark the boundary between two of them —
    // PLAY AGAIN goes straight from game over back into playing — so the machine's own
    // count is what tells the hook a new run has started.
    runSeq: state.context.runSeq,
    finished: isGameOver,
    mode,
    difficulty,
    score: state.context.score,
    hits,
    lives,
    maxStreak,
    strikes,
    elapsedMs,
    avgAccuracy,
    avgSpeed,
    personalBest: crossed.includes('record'),
    swept: sweptIn.gesture === state.context.runSeq,
    sweptHit: sweptIn.hit === state.context.runSeq,
    sweptStrike: sweptIn.strike === state.context.runSeq,
    batch: hitBatch,
    stats,
    standings,
    standingsLoaded: medalsLoaded,
    reigns,
    // UNTOUCHABLE is both Extreme all-time boards at once — the same reign the game-over
    // screen pays out for, read from the same two ids. Deliberately not the **crown**,
    // which took the phoenix in alongside them; see `holdsBothBoards`.
    crown: holdsBothBoards(userId, champions),
    crossed,
    guideRead: howToPlay.read,
    feedbackAnswered: feedbackAnswered.answered,
    sessionPlaces,
    userId,
    onUnlocked: (awards) => {
      for (const award of awards) {
        track('achievement_unlocked', { id: award.id, stage: award.stage })
      }
      achievementQueue.push(awards)
    },
  })
  const recordMultiplayer = achievements.recordMultiplayer

  return {
    achievements,
    announcement,
    askedAchievement,
    avgAccuracy,
    avgSpeed,
    celebration,
    coach,
    crossed,
    lostMedals,
    medalHistory,
    medals,
    playedScored,
    recordMultiplayer,
    sendDialed,
    setAskedAchievement,
    setStepUpOpen,
    setSweptIn,
    standings,
    stepUp,
    stepUpOpen,
  }
}

export type ScreenAnnouncements = ReturnType<typeof useRunAnnouncements>
