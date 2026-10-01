import { useCallback, useEffect, useRef } from 'react'

import {
  fullRange,
  pickTargetValue,
  rangeAround,
  type TargetRange,
} from '@/lib/target-value'
import type { GameSend } from '@/machines/game'
import { spawnInterval, type RunRules, type Submode } from '@/modes'

// Deals targets while a run is playing: the first one at once, then one every
// `spawnInterval`; clearing the board deals the next right away and restarts the cadence.
//
// Everything it does differently from one mode to the next is a field on the rules it is
// handed — the gap between arrivals, whether there is a cadence at all, how far a target
// may land from the sum standing, and the script a submode deals from. It names no mode,
// so a mode registered this morning spawns correctly.
export function useTargetSpawner({
  isPlaying,
  targetCount,
  rules,
  submode,
  hits,
  playerClockMs,
  currentSum,
  takenValues,
  send,
}: {
  isPlaying: boolean
  targetCount: number
  // The rules the run is played under — `spawn` is the half of them this reads, and
  // `board` is what bounds the values a target may take.
  rules: RunRules
  // The submode the run is in, or null. What deals the scripted targets: a lesson's
  // boards are chosen rather than rolled, each one making a single move the obvious
  // answer.
  submode: Submode | null
  // Drives the cadence in ramping modes: more hits, shorter gap between arrivals.
  hits: number
  // The run's player-set clock, from the machine's own context so the gap and the ring
  // are always read off the same number. Ignored by a mode whose clock is not the
  // player's — see `clock.playerSet`.
  playerClockMs: number
  currentSum: number
  takenValues: number[]
  send: GameSend
}) {
  const spawnTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cadence = rules.spawn.cadence

  // Latest exclusions, read at spawn time without re-creating the interval.
  const excludeRef = useRef<{ sum: number; values: number[] }>({
    sum: currentSum,
    values: takenValues,
  })
  excludeRef.current = { sum: currentSum, values: takenValues }

  // Read at spawn time for the same reason: `spawnTarget` is the callback the cadence
  // and the respawn both hold, and depending on either of these would rebuild both on a
  // change that only matters when a target is actually being dealt.
  const runRef = useRef({ rules, submode, hits })
  runRef.current = { rules, submode, hits }

  // Latest cadence, likewise read when a spawn fires rather than when the wait is
  // armed. See startCadence for why that matters.
  const spawnEvery = spawnInterval(
    rules,
    hits,
    rules.clock.playerSet ? playerClockMs : undefined,
  )
  const intervalRef = useRef(spawnEvery)
  intervalRef.current = spawnEvery

  const spawnTarget = useCallback(() => {
    const { sum, values } = excludeRef.current
    const { rules: live, submode: part, hits: landed } = runRef.current
    // A submode's own targets, dealt rather than rolled: each one is a board chosen to
    // make one move the obvious answer, and the lesson has a line ready for it. The
    // first of them is dealt by the machine at START, so what comes through here is the
    // rest of the script — and then nothing, once it has run out.
    const scripted = part?.script?.(landed) ?? null
    if (scripted !== null) {
      send({ type: 'ADD_TARGET', value: scripted, at: Date.now() })
      return
    }
    // A mode with a `reach` keeps every target within that much of the sum standing on
    // the dial — which, just after a hit, is the number just cleared. Every other mode
    // draws from the whole range the board can be dialled to.
    const range: TargetRange =
      live.spawn.reach === null
        ? fullRange(live.dial)
        : rangeAround(live.dial, sum, live.spawn.reach)
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
    // No cadence in a mode that runs none: the one target standing is the whole board
    // until it is hit, and the respawn below is what deals the next.
    if (cadence) startCadence()
    return () => {
      if (spawnTimer.current) clearTimeout(spawnTimer.current)
    }
  }, [isPlaying, cadence, spawnTarget, startCadence])

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
      if (cadence) startCadence()
    }
    prevTargetCount.current = targetCount
  }, [targetCount, isPlaying, cadence, spawnTarget, startCadence])
}
