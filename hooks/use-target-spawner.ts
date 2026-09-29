import { useCallback, useEffect, useRef } from 'react'

import { scriptedTarget, TUTORIAL_TARGET_REACH } from '@/constants/tutorial'
import {
  FULL_TARGET_RANGE,
  pickTargetValue,
  rangeAround,
  type TargetRange,
} from '@/lib/target-value'
import {
  effectiveSpawnInterval,
  type Difficulty,
  type GameSend,
  type Mode,
} from '@/machines/game'

// Spawns targets every effectiveSpawnInterval (first immediately) while playing;
// clearing the board spawns the next one right away and restarts the cadence.
//
// The tutorial runs no cadence at all: the board holds one target, and the respawn on a
// cleared board is the only thing that ever deals another — see constants/tutorial.ts.
export function useTargetSpawner({
  isPlaying,
  targetCount,
  mode,
  difficulty,
  hits,
  traineeTimeoutMs,
  tutorial,
  currentSum,
  takenValues,
  send,
}: {
  isPlaying: boolean
  targetCount: number
  mode: Mode
  difficulty: Difficulty
  // Drives the cadence in ramping modes: more hits, shorter gap between arrivals.
  hits: number
  // Trainee's player-set clock, from the machine's own context so the gap and the ring
  // are always read off the same number.
  traineeTimeoutMs: number
  // The run is the tutorial. Both halves of its spawning rule are read off this: one
  // target at a time, and the next one within reach of the last.
  tutorial: boolean
  currentSum: number
  takenValues: number[]
  send: GameSend
}) {
  const spawnTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Latest exclusions, read at spawn time without re-creating the interval.
  const excludeRef = useRef<{ sum: number; values: number[] }>({
    sum: currentSum,
    values: takenValues,
  })
  excludeRef.current = { sum: currentSum, values: takenValues }

  // Read at spawn time for the same reason: `spawnTarget` is the callback the cadence
  // and the respawn both hold, and depending on either of these would rebuild both on a
  // change that only matters when a target is actually being dealt.
  const tutorialRef = useRef({ tutorial, hits })
  tutorialRef.current = { tutorial, hits }

  // Latest cadence, likewise read when a spawn fires rather than when the wait is
  // armed. See startCadence for why that matters.
  const spawnEvery = effectiveSpawnInterval(
    mode,
    difficulty,
    hits,
    mode === 'trainee' ? traineeTimeoutMs : undefined,
  )
  const intervalRef = useRef(spawnEvery)
  intervalRef.current = spawnEvery

  const spawnTarget = useCallback(() => {
    const { sum, values } = excludeRef.current
    const { tutorial: onTutorial, hits: landed } = tutorialRef.current
    // The lesson's own targets, dealt rather than rolled: each one is a board chosen to make
    // one move the obvious answer, and the lesson has a line ready for it. The first of them
    // is dealt by the machine at START, so what comes through here is the rest of the script
    // — and then nothing, once it has run out. See constants/tutorial.ts.
    const scripted = onTutorial ? scriptedTarget(landed) : null
    if (scripted !== null) {
      send({ type: 'ADD_TARGET', value: scripted, at: Date.now() })
      return
    }
    // Past the script, the tutorial keeps every target within reach of the one just hit —
    // which is the sum standing on the dial, because hitting a target is what put it there.
    // Every other mode draws from the whole range.
    const range: TargetRange = onTutorial
      ? rangeAround(sum, TUTORIAL_TARGET_REACH)
      : FULL_TARGET_RANGE
    // Never spawn a target that's already the dialled sum, or a duplicate of a
    // target already on the board.
    const value = pickTargetValue({
      roll: Math.random(),
      taken: [sum, ...values],
      range,
    })
    send({ type: 'ADD_TARGET', value, at: Date.now() })
  }, [send])

  // A self-rescheduling chain rather than setInterval, because an interval's period
  // is fixed when it is armed. Following the ramp with setInterval would mean
  // clearing and re-arming on every hit, which keeps pushing the next spawn further
  // away — a fast player would starve the board. Each wait instead reads the current
  // cadence as it is scheduled, so the gap tightens on its own.
  const startCadence = useCallback(() => {
    function wait() {
      spawnTimer.current = setTimeout(() => {
        spawnTarget()
        wait()
      }, intervalRef.current)
    }
    if (spawnTimer.current) clearTimeout(spawnTimer.current)
    wait()
  }, [spawnTarget])

  // Read when play resumes rather than depended on, so the effect below runs on the
  // transition and not on every arrival and hit.
  const targetCountRef = useRef(targetCount)
  targetCountRef.current = targetCount

  useEffect(() => {
    if (!isPlaying) {
      if (spawnTimer.current) clearTimeout(spawnTimer.current)
      return
    }
    // Only an empty board needs filling this instant — which a fresh run always is.
    // Coming back from a pause the board still holds everything it had, and spawning
    // here would hand the player an extra target for having paused.
    if (targetCountRef.current === 0) spawnTarget()
    // No cadence in the tutorial: the one target standing is the whole board until it is
    // hit, and the respawn below is what deals the next.
    if (!tutorial) startCadence()
    return () => {
      if (spawnTimer.current) clearTimeout(spawnTimer.current)
    }
  }, [isPlaying, tutorial, spawnTarget, startCadence])

  // Immediate respawn when a hit clears the board mid-game. Reset the tracker
  // whenever we're not playing so a fresh game's targets→0 reset isn't mistaken
  // for a cleared board (which would spawn an extra target on start).
  const prevTargetCount = useRef(0)
  useEffect(() => {
    if (!isPlaying) {
      prevTargetCount.current = 0
      return
    }
    if (prevTargetCount.current > 0 && targetCount === 0) {
      spawnTarget()
      if (!tutorial) startCadence()
    }
    prevTargetCount.current = targetCount
  }, [targetCount, isPlaying, tutorial, spawnTarget, startCadence])
}
