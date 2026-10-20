import { useCallback, useEffect, useRef } from 'react'

import { drillValues } from '@/lib/drill'
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
  dealt,
  drill,
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
  // How many targets this run has dealt so far, which is what indexes a **drill**.
  //
  // Not `hits`, and the difference is the whole of why this is a parameter. A drilled
  // run deals nine in a fixed order whether or not any of them has been hit yet, so
  // indexing by hits would deal the first target again every time one was still
  // standing. The machine counts arrivals in `nextTargetId`; that is this.
  dealt: number
  // The **drill** this run deals from — its seed and how many it holds — or null for a
  // mode that rolls its targets. Resolved once by the caller through `drillFor`, so
  // this and the board's own placement are reading the same answer.
  drill: { seed: string; count: number } | null
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
  // A **drilled** run deals a fixed list on a metronome and nothing hurries it. See the
  // respawn below, which is the one thing that would.
  const drilled = drill !== null

  // Latest exclusions, read at spawn time without re-creating the interval.
  const excludeRef = useRef<{ sum: number; values: number[] }>({
    sum: currentSum,
    values: takenValues,
  })
  excludeRef.current = { sum: currentSum, values: takenValues }

  // Read at spawn time for the same reason: `spawnTarget` is the callback the cadence
  // and the respawn both hold, and depending on either of these would rebuild both on a
  // change that only matters when a target is actually being dealt.
  const runRef = useRef({ rules, submode, hits, dealt, drill })
  runRef.current = { rules, submode, hits, dealt, drill }

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
    const {
      rules: live,
      submode: part,
      hits: landed,
      dealt: out,
      drill: list,
    } = runRef.current
    // A **drill**: the session's own nine, dealt in order and then no more.
    //
    // Indexed by what has been dealt rather than by what has been hit, so the order
    // holds however the board is doing. And read fresh on every spawn rather than held,
    // because `dealt` is what the index comes from and the ref above is what keeps that
    // current — a drill computed once and closed over would deal its first target
    // forever.
    if (list !== null) {
      const next = drillValues(list.seed, live.dial, list.count)[out]
      // Spent. The run ends on the machine's side, when the board clears — nothing
      // here deals a tenth.
      if (next === undefined) return
      send({ type: 'ADD_TARGET', value: next, at: Date.now() })
      return
    }
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
  //
  // **Never on a drilled run**, and this is the whole of why that matters. A drill is a
  // fixed list arriving on a fixed metronome: the player clears the board constantly —
  // it holds one card for most of the opening seconds — and respawning on every clear
  // deals the next target the instant the last one is taken. What that looks like on
  // screen is the thing a drill is built not to be: you hit a card, it goes, and
  // another appears in its place. The nine arrive when they arrive.
  const prevTargetCount = useRef(0)
  useEffect(() => {
    if (!isPlaying) {
      prevTargetCount.current = 0
      return
    }
    if (!drilled && prevTargetCount.current > 0 && targetCount === 0) {
      spawnTarget()
      if (cadence) startCadence()
    }
    prevTargetCount.current = targetCount
  }, [targetCount, isPlaying, cadence, drilled, spawnTarget, startCadence])
}
