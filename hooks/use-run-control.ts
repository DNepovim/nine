import { useMachine } from '@xstate/react'
import { useFonts } from 'expo-font'
import { useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { useAnimatedStyle } from 'react-native-reanimated'

import DSEG7Font from '@/assets/fonts/DSEG7Classic-Bold.ttf'
import { TARGET_FORMS } from '@/components/game/target-forms'
import { SCHEMES } from '@/constants/colors'
import { mono } from '@/constants/theme'
import { useDisplayOptions } from '@/hooks/use-display-options'
import { useOpening } from '@/hooks/use-opening'
import { usePauseOnBlur } from '@/hooks/use-pause-on-blur'
import { usePersistedDifficulty } from '@/hooks/use-persisted-difficulty'
import { usePersistedMode } from '@/hooks/use-persisted-mode'
import { usePersistedStats } from '@/hooks/use-persisted-stats'
import { useSavedRun } from '@/hooks/use-saved-run'
import { glowStyle } from '@/hooks/use-scheme'
import { track } from '@/lib/analytics'
import type { AnalyticsEvents } from '@/lib/analytics-events'
import { newRunId } from '@/lib/run-id'
import { restoredSessionOf } from '@/lib/run-session'
import { accentFor, subtitleFor } from '@/lib/run-title'
import { restoreRun, savedPositions } from '@/lib/saved-run'
import { claimedTime, gameMachine } from '@/machines/game'
import { runRules, runSubmode, targetFormOf } from '@/modes'
import type { Position } from '@/types/game'

// How long the board stands still after CONTINUE before the run picks up again. The
// pause screen goes at once, so the player gets the grid, the targets and their frozen
// clocks back with a beat to read them in — coming straight back to a running clock is
// what made resuming cost a life. The machine ignores presses while it is still paused,
// so the dial is inert for the beat rather than only looking it.
const RESUME_DELAY_MS = 500
// The run as the game screen drives it: the machine and what it holds, the rules it is
// governed by, the opening it is held for, and the ways it is paused, resumed, saved and
// put back — with the display options the run is drawn under.
export function useRunControl() {
  const [state, send, actor] = useMachine(gameMachine)

  // Seven-segment font for the digital score readout.
  const [dsegLoaded] = useFonts({ DSEG7: DSEG7Font })
  // The seven-segment face, or the mono voice until it has loaded. Resolved once: every
  // readout on this screen takes the same answer, and a figure in the wrong face for a
  // frame beats a row that is not there.
  const digitFont = dsegLoaded ? 'DSEG7' : mono

  const {
    grid,
    lives,
    targets,
    mode,
    difficulty,
    stats,
    hitBatch,
    streak,
    maxStreak,
    strikes,
    accSum,
    spdSum,
    hits,
    elapsedMs,
    runId,
    tutorial,
  } = state.context
  // What this run is governed by: the board under it, the clock, the lives, the streak
  // rule, and the four capability flags the screen used to ask `mode === 'trainee'` for.
  // One lookup rather than a branch at each reader, and the only thing on this screen
  // that knows a mode has rules at all.
  const rules = runRules(mode, difficulty, tutorial)
  const runAccent = accentFor(mode)
  const runSubtitle = subtitleFor(mode, rules.usesDifficulty, difficulty)
  const submode = runSubmode(tutorial)
  // The dial this run is played on. `board` on this screen is already the leaderboard.
  const dial = rules.dial
  // What this run is placed on its session's standings by — the medal on the game-over
  // screen and the title above it both ask, and both have to ask what the write posts.
  const runFigures = {
    score: state.context.score,
    hits: state.context.hits,
    timeMs: claimedTime(state.context, rules),
  }

  const isPlaying = state.matches('playing')
  const isMenu = state.matches('menu')
  const isPaused = state.matches('paused')
  const isGameOver = state.matches('gameOver')
  // The run's **opening**, if its mode has one: whether the run is held **ready** for it,
  // the take, the switch and the **scheme** the game screen is drawn in — see `useOpening`
  // and `ready` in machines/game.ts. A held run is not `inRun`: nothing is being played
  // yet, so nothing is saved, celebrated or raced against.
  const opening = useOpening({ state: state.value, mode })
  // The neon corona the rows above the dial are lit with, where their scheme has one.
  const barGlow = glowStyle(SCHEMES[opening.barScheme].inks.glow)
  // The rows above the dial, as lit as the opening has them: dark until a scene switches them on.
  const barLightStyle = useAnimatedStyle(() => ({ opacity: opening.barLight.value }))
  const { Board: TargetBoard, Card: TargetView } = TARGET_FORMS[targetFormOf(mode)]

  // The one way a pause is asked for, so that every caller has to say what stopped the
  // run and the event below can tell a tap from a phone call. The reporting half is here
  // rather than in an effect on `isPaused` because the figure worth sending is only
  // correct before PAUSE lands: `elapsedMs` is banked on the way out of `playing`, so the
  // stretch still being played has to be added by hand either way, and doing it here
  // keeps the reason and the numbers in one place.
  //
  // Nothing is reported for a pause that finds no live run — the dev screen sends PAUSE
  // blind, to put down whatever is standing before it deals a tutorial.
  const pauseRun = (source: AnalyticsEvents['run_paused']['source']) => {
    const now = Date.now()
    if (isPlaying) {
      const { score, hits, strikes, elapsedMs, playingSince } = state.context
      track('run_paused', {
        mode,
        difficulty,
        source,
        score,
        hits,
        strikes,
        elapsed_ms: elapsedMs + (playingSince === null ? 0 : now - playingSince),
      })
    }
    send({ type: 'PAUSE', now })
  }

  // A run left behind — the app switched away from, the phone locked — comes back
  // paused rather than still running.
  usePauseOnBlur(isPlaying, () => {
    pauseRun('focus_lost')
  })

  // The beat between CONTINUE and the run picking up again — see RESUME_DELAY_MS. The
  // pause screen is gone for it, the machine is still paused through it.
  const [resuming, setResuming] = useState(false)
  // Read out here rather than inside the effect: it is set once on the way into the pause
  // and does not move again, so it can sit in the dependency list without the whole
  // machine context dragging the timer along with it.
  const pausedAt = state.context.pausedAt
  useEffect(() => {
    if (!resuming) return
    const timer = setTimeout(() => {
      setResuming(false)
      const now = Date.now()
      // Reported here and not at the tap, because the tap is not yet a resume — going
      // away cancels the beat and leaves the run paused, and an event sent on the tap
      // would have claimed otherwise.
      track('run_resumed', {
        mode,
        difficulty,
        away_ms: pausedAt === null ? 0 : now - pausedAt,
      })
      send({ type: 'RESUME', now })
    }, RESUME_DELAY_MS)
    // The beat only runs while the app is on screen. A resume landing in a hidden tab
    // would put the run back on a wall clock with nobody watching it — the very thing
    // usePauseOnBlur exists to prevent, and out of its reach here because the run is not
    // playing yet. Going away cancels it instead, leaving the pause screen where it was.
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') setResuming(false)
    })
    return () => {
      clearTimeout(timer)
      subscription.remove()
    }
  }, [resuming, send, pausedAt, mode, difficulty])
  // Any other way out of the pause — HOME, END RUN, a restored run landing — drops the
  // pending resume instead of firing it into whatever took its place.
  useEffect(() => {
    if (!isPaused) setResuming(false)
  }, [isPaused])

  usePersistedStats(stats, send)
  usePersistedDifficulty(difficulty, send)
  usePersistedMode(mode, send)

  // Which **session** the live run belongs to, or null for an ordinary run.
  //
  // Beside the run rather than on the machine's context. A session is not a rule — the
  // engine resolves `RunRules` and has no business knowing when a mode is being offered
  // — so putting it there would be the first thing in that neighbourhood that is not
  // one. The cost is that a run put back from storage mid-session loses it and posts to
  // no standings; the ten-minute grace on the write makes that a near miss rather than
  // a loss, and a run interrupted by the app dying is already an edge.
  const [runSession, setRunSession] = useState<string | null>(null)

  // When the run's session shuts, for the countdown on the score bar.
  //
  // Beside `runSession` rather than folded into it, which keeps the id a plain string
  // for the handful of places that pass it on. **Never cleared**, and it does not need
  // to be: every reader below is already behind `runSession !== null`, so a figure left
  // over from a finished run is a value nothing asks for.
  //
  // Taken from the card the run was started from rather than fetched. The session was
  // read once at launch and the dialog was looking at it a moment ago; asking the server
  // again for a timestamp the screen is already holding would be a round trip to learn
  // something it knows.
  const [runSessionClosesAt, setRunSessionClosesAt] = useState<number | null>(null)

  // Whether the run's session shut under it. Set by the strip, which holds the clock that
  // reaches the boundary, and read for one frame's worth of red before the run ends.
  //
  // Beside `runSessionClosesAt` rather than on the machine's context, and for the reason
  // the note above gives about that one: the machine has never heard of a session and
  // does not learn about one here. What it is told, a second later, is that this run is
  // over — see the `EXPIRE` send below.
  const [windowShut, setWindowShut] = useState(false)

  // The run the app was last closed on. Put back paused, before anything else this
  // launch does with the machine: RESTORE carries the board it was played on, so a
  // persisted mode landing either side of it cannot deal the run somewhere else.
  //
  // `taken` first, in the same commit as the send, so the intro is never painted in the
  // gap between storage answering and the machine holding the run — see `onIntro`.
  const savedRun = useSavedRun()
  // Where the restored run's targets were sitting when the app was closed. State rather
  // than a ref because the display list reads it as it places them, which happens in the
  // render RESTORE causes — and both are set here, in one commit.
  const [restoredPositions, setRestoredPositions] = useState<
    ReadonlyMap<number, Position>
  >(() => new Map())
  useEffect(() => {
    if (savedRun.pending === null || !isMenu) return
    // One reading of the clock for both: the ages are laid back down against it, and it
    // is the moment the restored board has been standing still since.
    const now = Date.now()
    setRestoredPositions(savedPositions(savedRun.pending))
    // The session it was posting to, put back with it — or cleared, for an ordinary run.
    // Before the run is dealt, for the reason the challenge dialog sets it before START:
    // the drill and the first record post both read it.
    const session = restoredSessionOf(savedRun.pending)
    setRunSession(session.id)
    setRunSessionClosesAt(session.closesAt)
    setWindowShut(false)
    savedRun.taken()
    send({ type: 'RESTORE', run: restoreRun(savedRun.pending, now, newRunId()), now })
  }, [savedRun, isMenu, send])
  const {
    showSum,
    toggleSum,
    showPar,
    togglePar,
    showStats,
    toggleStats,
    showRoute,
    toggleRoute,
    drag,
    toggleDrag,
    playerClockMs,
    setPlayerClockMs,
    corners,
    setCorner,
  } = useDisplayOptions()

  // The machine spawns targets with it, so the setting has to reach the context — on
  // hydration and on every change after. Mid-run is fine: the targets already in flight
  // are moved onto the new clock keeping the share of it they had left, which is what
  // makes changing it from a pause show its effect on the target you are looking at.
  useEffect(() => {
    send({ type: 'SET_PLAYER_CLOCK', ms: playerClockMs, now: Date.now() })
  }, [playerClockMs, send])

  return {
    TargetBoard,
    TargetView,
    accSum,
    actor,
    barGlow,
    barLightStyle,
    corners,
    dial,
    difficulty,
    digitFont,
    drag,
    elapsedMs,
    grid,
    hitBatch,
    hits,
    isGameOver,
    isMenu,
    isPaused,
    isPlaying,
    lives,
    maxStreak,
    mode,
    opening,
    pauseRun,
    playerClockMs,
    restoredPositions,
    resuming,
    rules,
    runAccent,
    runFigures,
    runId,
    runSession,
    runSessionClosesAt,
    runSubtitle,
    savedRun,
    send,
    setCorner,
    setPlayerClockMs,
    setResuming,
    setRunSession,
    setRunSessionClosesAt,
    setWindowShut,
    showPar,
    showRoute,
    showStats,
    showSum,
    spdSum,
    state,
    stats,
    streak,
    strikes,
    submode,
    targets,
    toggleDrag,
    togglePar,
    toggleRoute,
    toggleStats,
    toggleSum,
    tutorial,
    windowShut,
  }
}

export type ScreenControl = ReturnType<typeof useRunControl>
