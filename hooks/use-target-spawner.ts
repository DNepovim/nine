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
  currentSum,
  takenValues,
  send,
}: {
  isPlaying: boolean
  targetCount: number
  mode: Mode
  difficulty: Difficulty
  currentSum: number
  takenValues: number[]
  send: GameSend
}) {
  const spawnTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Latest exclusions, read at spawn time without re-creating the interval.
  const excludeRef = useRef<{ sum: number; values: number[] }>({
    sum: currentSum,
    values: takenValues,
  })
  excludeRef.current = { sum: currentSum, values: takenValues }

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

  const restartCadence = useCallback(() => {
    if (spawnTimer.current) clearInterval(spawnTimer.current)
    spawnTimer.current = setInterval(
      spawnTarget,
      effectiveSpawnInterval(mode, difficulty),
    )
  }, [spawnTarget, mode, difficulty])

  useEffect(() => {
    if (!isPlaying) {
      if (spawnTimer.current) clearInterval(spawnTimer.current)
      return
    }
    spawnTarget()
    restartCadence()
    return () => {
      if (spawnTimer.current) clearInterval(spawnTimer.current)
    }
  }, [isPlaying, spawnTarget, restartCadence])

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
      restartCadence()
    }
    prevTargetCount.current = targetCount
  }, [targetCount, isPlaying, spawnTarget, restartCadence])
}
