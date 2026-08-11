import { useCallback, useEffect, useRef } from 'react'

import { MAX_TARGET } from '@/constants/game'
import {
  effectiveSpawnInterval,
  type Difficulty,
  type GameSend,
  type Mode,
} from '@/machines/game'

// Spawns targets every effectiveSpawnInterval (first immediately) while playing;
// clearing the board spawns the next one right away and restarts the cadence.
export function useTargetSpawner({
  isPlaying,
  targetCount,
  mode,
  difficulty,
  hits,
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

  // Latest cadence, likewise read when a spawn fires rather than when the wait is
  // armed. See startCadence for why that matters.
  const intervalRef = useRef(effectiveSpawnInterval(mode, difficulty, hits))
  intervalRef.current = effectiveSpawnInterval(mode, difficulty, hits)

  const spawnTarget = useCallback(() => {
    const { sum, values } = excludeRef.current
    // Never spawn a target that's already the dialled sum, or a duplicate of a
    // target already on the board.
    const taken = new Set<number>([sum, ...values])
    let value = Math.floor(Math.random() * (MAX_TARGET + 1))
    if (taken.has(value)) {
      const base = value
      for (let d = 1; d <= MAX_TARGET; d++) {
        if (base + d <= MAX_TARGET && !taken.has(base + d)) {
          value = base + d
          break
        }
        if (base - d >= 0 && !taken.has(base - d)) {
          value = base - d
          break
        }
      }
    }
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

  useEffect(() => {
    if (!isPlaying) {
      if (spawnTimer.current) clearTimeout(spawnTimer.current)
      return
    }
    spawnTarget()
    startCadence()
    return () => {
      if (spawnTimer.current) clearTimeout(spawnTimer.current)
    }
  }, [isPlaying, spawnTarget, startCadence])

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
      startCadence()
    }
    prevTargetCount.current = targetCount
  }, [targetCount, isPlaying, spawnTarget, startCadence])
}
