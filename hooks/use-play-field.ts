import { useEffect, useMemo, useRef, useState } from 'react'
import { type LayoutChangeEvent } from 'react-native'

import { PIE_SIZE } from '@/constants/game'
import { TUTORIAL_BANNER_HEIGHT } from '@/constants/tutorial'
import { SUM_ROW_HEIGHT } from '@/hooks/use-dial-metrics'
import { useDisplayedTargets } from '@/hooks/use-displayed-targets'
import { useDriftTicks } from '@/hooks/use-drift-ticks'
import { useFloatingPoints } from '@/hooks/use-floating-points'
import { useFloatingStat } from '@/hooks/use-floating-stat'
import { useHeldSum } from '@/hooks/use-held-sum'
import { usePersistedRun } from '@/hooks/use-persisted-run'
import type { ScreenAnnouncements } from '@/hooks/use-run-announcements'
import type { ScreenBoards } from '@/hooks/use-run-boards'
import type { ScreenControl } from '@/hooks/use-run-control'
import type { ScreenEnding } from '@/hooks/use-run-ending'
import { useScoreDirection } from '@/hooks/use-score-direction'
import { useSegments } from '@/hooks/use-segments'
import { useStrikeShots, type ShotAim } from '@/hooks/use-strike-shots'
import { useTargetSpawner } from '@/hooks/use-target-spawner'
import { useTargetsShortcuts } from '@/hooks/use-targets-shortcuts'
import { useTaughtOffer } from '@/hooks/use-taught-offer'
import { useTutorialLesson } from '@/hooks/use-tutorial-lesson'
import { track } from '@/lib/analytics'
import { drillFor } from '@/lib/drill'
import { headingOf } from '@/lib/run-average'
import { newRunId } from '@/lib/run-id'
import { savedSessionOf } from '@/lib/run-session'
import { STEP_UP_BOARD } from '@/lib/step-up'
import { tipForTarget } from '@/lib/tutorial-tip'
import { keyControl, type LessonVoice } from '@/machines/tutorial-lesson'
import { cellsOf, gradientOf, streakMultiplier, sumOf } from '@/modes'
import { challengeTints, hueOf } from '@/modes/challenges/palette'
import type { DisplayTarget } from '@/types/game'

// What the board draws, given what the lesson is saying.
//
// Everything standing on it, except behind the lesson's first word — which is set in the
// middle of the board and is the only thing on it until the word's own clock runs out.
//
// Held back on the way out rather than dealt late: the machine opens a tutorial with its
// target already standing, which is right — the run is the run from the moment it starts,
// and a target that arrived a beat after it would be a second kind of opening to get wrong.
// So this is a target not yet drawn, and it springs in as the words fade.
const drawnTargets = (
  voice: LessonVoice,
  placed: readonly DisplayTarget[],
): readonly DisplayTarget[] => (voice === 'opening' ? [] : placed)
// The field a run is played on: the dial's segments and sum, the drill, the spawner, the
// targets as drawn, the tutorial's lesson over them, the strike shots, and the run saved as
// it goes.
export function usePlayField({
  control,
  boards,
  announcements,
  ending,
}: {
  control: ScreenControl
  boards: ScreenBoards
  announcements: ScreenAnnouncements
  ending: ScreenEnding
}) {
  const {
    dial,
    difficulty,
    grid,
    hitBatch,
    hits,
    isPaused,
    isPlaying,
    mode,
    opening,
    pauseRun,
    restoredPositions,
    rules,
    runId,
    runSession,
    runSessionClosesAt,
    savedRun,
    send,
    state,
    streak,
    submode,
    targets,
    tutorial,
  } = control
  const { inRun } = boards
  const { avgAccuracy, avgSpeed, playedScored } = announcements
  const { endRunEarly } = ending
  // A drawing board is drawn on: a tap on the targets area marks a point, and two make a
  // segment. Worn by the scheme, not by a mode's name. See lib/segments.ts.
  const drafting = opening.dialScheme === 'drafting'
  // How far the board has been drawn, where the rows above the dial are drawn in with it.
  const barDrawn = drafting ? opening.sweep : null
  const { drawing, plot } = useSegments(runId, grid)

  const targetsShortcuts = useTargetsShortcuts({
    playing: isPlaying,
    tutorial,
    onPlot: drafting
      ? (x, y) => {
          plot({ x, y })
        }
      : null,
    onPause: () => {
      pauseRun('double_tap')
    },
    onRestart: () => {
      endRunEarly('restart')
      send({ type: 'RESTART', now: Date.now(), runId: newRunId() })
      track('run_started', { mode, difficulty, from: 'hold' })
    },
  })

  // The dial sum drives the score above the dial; the machine's composite score
  // drives the digital HUD readout.
  const sum = sumOf(dial, grid)
  // What the sum row shows, which is `sum` on every dial but a **freezing** one: there it
  // is the sum the last hit left, taken again only when a hit lands or a run starts — the
  // run's id changes on START, RESTART and RESTORE alike. The row's digits, their flip and
  // their tint all read it, so none of them gives the real sum away. Everything else —
  // the spawner above all — reads the real one.
  const shownSum = useHeldSum(sum, {
    freeze: dial.freeze,
    key: `${runId}:${hitBatch.seq}`,
  })
  const direction = useScoreDirection(shownSum)

  // The **drill** this run deals from, where it has one — see `drillFor`.
  const drill = drillFor(rules, mode, runSession)
  // One pale tint per card, out of this challenge's own hue. Stable across runs because
  // nothing about it is rolled — the nth card of a drill is the nth tint — and null for
  // every mode that rolls its targets, whose discs are tinted by the hundreds instead.
  const drillTints = useMemo(
    () =>
      drill === null ? null : challengeTints(hueOf(gradientOf(mode)[1]), drill.count),
    [drill === null, drill?.count, mode],
  )

  // A drifting number arriving on the dialled sum is a hit — see `TICK`.
  useDriftTicks({ isPlaying, targets, step: rules.spawn.drift, send })

  useTargetSpawner({
    isPlaying,
    targetCount: targets.length,
    // What a **drill** is indexed by: arrivals this run, not hits and not ids.
    // `nextTargetId` climbs for the life of the machine and never restarts — see the
    // note on it — so a second run of a drilled mode indexed by it starts past the end
    // of the drill and deals nothing at all. `dealt` restarts with the run, and
    // survives the run being put away and brought back.
    dealt: state.context.dealt,
    drill,
    rules,
    submode,
    hits,
    playerClockMs: state.context.playerClockMs,
    currentSum: sum,
    standing: targets,
    send,
  })
  const { floats, removeFloat } = useFloatingPoints(hitBatch)
  // How far into the lesson the player has got, and how many times the stepper has put
  // them back.
  //
  // `furthest` is a high-water mark rather than a stored step: raised by play, never by
  // the stepper, and seeded from the run's own hit count — so a tutorial put back from
  // storage mid-run arrives with everything it had already played behind it, and nothing
  // extra has to be persisted for that.
  const [furthestStep, setFurthestStep] = useState(0)
  // Only ever climbs, and nobody reads the number itself — the lesson and the display
  // list both want to know that a rewind happened, not which one. Declared above the two
  // hooks that take it, which is why it sits ahead of the board rather than beside the
  // stepper that raises it.
  const [rewindSeq, setRewindSeq] = useState(0)
  // How many times the player has shuffled the dial by hand, which the dial counts with the hits:
  // a shuffle is a scramble it did not see arrive with a hit.
  const [shuffles, setShuffles] = useState(0)
  const shuffleDial = () => {
    send({ type: 'SHUFFLE', now: Date.now() })
    setShuffles((count) => count + 1)
  }

  const { displayedTargets, removeDisplayed, onContainerLayout, canvas, drillCards } =
    useDisplayedTargets({
      machineTargets: targets,
      hitBatch,
      runSeq: state.context.runSeq,
      rewindSeq,
      restoredPositions,
      drill,
    })

  // Raised by play alone. A rewind drops `hits`, and the max is what makes that drop
  // invisible here: ground covered stays covered.
  useEffect(() => {
    setFurthestStep((reached) => Math.max(reached, hits))
  }, [hits])

  // A fresh run starts the mark over, seeded from the hit count that run arrived with —
  // nought for a run just dealt, and whatever it had already played for one put back from
  // storage. Read through a ref rather than depended on, for the reason the lesson does
  // the same: `hits` moves inside a run, and an effect watching it would reset the mark
  // on the first hit of the very run it was tracking.
  const hitsRef = useRef(hits)
  hitsRef.current = hits
  useEffect(() => {
    setFurthestStep(hitsRef.current)
  }, [state.context.runSeq])

  // The tutorial's lesson: what it is saying, and how much of the dial it is holding while
  // it says it. Silent and inert in every run that is not a tutorial, and in a tutorial put
  // back from storage with hits already on it.
  const lesson = useTutorialLesson({
    tutorial,
    isPlaying,
    runSeq: state.context.runSeq,
    rewindSeq,
    hits,
    batch: hitBatch,
    grid,
    targets,
  })

  // The tutorial's own end: the lesson is over and a stretch of rolled targets has gone
  // down after it, so the run asks whether they would rather play a real one.
  const taught = useTaughtOffer({
    tutorial,
    isPlaying,
    taught: lesson.taught,
    hits,
    playedScored,
    runSeq: state.context.runSeq,
  })
  // Opened once per run and never reopened by a dismissal, so the rising edge is the
  // offer being made — the same thing the toast's own latch above counts.
  useEffect(() => {
    if (!taught.open) return
    track('challenge_offered', {
      mode,
      difficulty,
      to_mode: STEP_UP_BOARD.mode,
      to: STEP_UP_BOARD.difficulty,
    })
  }, [taught.open, mode, difficulty])

  // Where the lesson's card goes while it is pointing at the target, and which way its beak
  // turns — beside the target, on whichever side of it the canvas has room for. The
  // tutorial holds one target, so there is never a question of which.
  const lessonTarget = displayedTargets[0]
  const tip =
    lessonTarget === undefined
      ? null
      : tipForTarget(lessonTarget.position, canvas.height, TUTORIAL_BANNER_HEIGHT)

  const boardTargets = drawnTargets(lesson.voice, displayedTargets)

  // Where the board and the sum row sit inside the effect layer over them. A shot needs
  // the board's origin as well as its size: a target's position is measured from the
  // board, and the sum row the shot leaves from is measured from the box holding both.
  //
  // Only the board's size comes from its own layout event. Its origin is read off the
  // sum row, which follows it directly: on web a layout event's x/y are measured from
  // the view's DOM parent, and the board's parent is the `display: contents` wrapper
  // its GestureDetector draws — a box with no place of its own, so the board came back
  // measured from the page and every shot landed a top bar's height too low, under the
  // dial. The sum row is a plain child of the box the shot layer covers.
  const boardSize = useRef({ width: 0, height: 0 })
  const noteBoardSize = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    boardSize.current = { width, height }
  }
  const sumRowRect = useRef({ x: 0, y: 0, width: 0 })
  const noteSumRowRect = (event: LayoutChangeEvent) => {
    const { x, y, width } = event.nativeEvent.layout
    sumRowRect.current = { x, y, width }
  }

  // Where a strike fires from and what it is aimed at. The muzzle is the middle of the
  // sum row; the board sits on top of that row, as wide as it, so its origin is the
  // row's top edge less the board's height.
  // How wide the card for this target is drawn — the drill's own answer where there is
  // one, and the size every other mode draws otherwise.
  const sizeOfCard = (seq: number): number => drillCards?.[seq]?.size ?? PIE_SIZE

  const aimShot = (value: number): ShotAim | null => {
    const size = boardSize.current
    const row = sumRowRect.current
    if (size.width === 0 || row.width === 0) return null
    const board = {
      x: row.x + (row.width - size.width) / 2,
      y: row.y - size.height,
    }
    // Live targets never share a value, so the hit carrying this one names one card.
    const target = displayedTargets.find((entry) => entry.value === value)
    if (target === undefined) return null
    return {
      from: {
        x: row.x + row.width / 2,
        y: row.y + SUM_ROW_HEIGHT / 2,
      },
      to: {
        // The middle of this card, which is not the middle of every card: a drilled run
        // draws its nine at nine different sizes.
        x: board.x + target.position.x + sizeOfCard(target.seq) / 2,
        y: board.y + target.position.y + sizeOfCard(target.seq) / 2,
      },
      radius: sizeOfCard(target.seq) / 2,
      // A hit is the sum landing on the target's value, so this is the number standing
      // in the sum row as the shot leaves it.
      sumDigits: String(value).length,
    }
  }

  const { shots, removeShot, flame, legs } = useStrikeShots({
    mode,
    runSeq: state.context.runSeq,
    hitBatch,
    aim: aimShot,
  })

  // Keeps the device's copy of the run in step with this one, so closing the app on it
  // is not losing it. Below the display list because it writes the board down as the
  // player sees it — targets and the spots they are sitting in — and only the list
  // knows the second half.
  usePersistedRun({
    inRun,
    isPaused,
    run: state.context,
    placed: displayedTargets,
    session: savedSessionOf(runSession, runSessionClosesAt),
    settled: savedRun.settled,
  })

  // What each of the nine keys will take. `full` throughout every run but a guided
  // tutorial route, where the lesson lights one key and shuts the other eight.
  const dialControls = useMemo(
    () => cellsOf(dial).map((index) => keyControl(lesson.dial, lesson.liveKey, index)),
    [lesson.dial, lesson.liveKey],
  )

  const currentMultiplier = streakMultiplier(streak)

  const { floatStats, removeFloatStat } = useFloatingStat(
    hitBatch,
    rules.scoring.headline,
  )

  const avgStat = { acc: avgAccuracy, spd: avgSpeed }[rules.scoring.headline]
  const prevAvgRef = useRef(avgStat)
  const avgDirection = useRef<1 | -1>(1)
  if (avgStat !== prevAvgRef.current) {
    avgDirection.current = headingOf(avgStat, prevAvgRef.current)
    prevAvgRef.current = avgStat
  }

  return {
    avgDirection,
    avgStat,
    barDrawn,
    boardTargets,
    currentMultiplier,
    dialControls,
    direction,
    drafting,
    drawing,
    drill,
    drillCards,
    drillTints,
    flame,
    floatStats,
    floats,
    furthestStep,
    legs,
    lesson,
    noteBoardSize,
    noteSumRowRect,
    onContainerLayout,
    removeDisplayed,
    removeFloat,
    removeFloatStat,
    removeShot,
    setRewindSeq,
    shots,
    shownSum,
    shuffleDial,
    shuffles,
    targetsShortcuts,
    taught,
    tip,
  }
}

export type ScreenField = ReturnType<typeof usePlayField>
