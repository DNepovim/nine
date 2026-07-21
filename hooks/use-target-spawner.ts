import { useCallback, useEffect, useRef } from 'react'

import { MAX_TARGET } from '@/constants/game'
import { DIFFICULTIES, type Difficulty, type GameSend } from '@/machines/game'

// Spawns targets every difficulty.spawnInterval (first immediately) while playing;
// clearing the board spawns the next one right away and restarts the cadence.
export function useTargetSpawner({
  isPlaying,
  targetCount,
  difficulty,
  send,
}: {
  isPlaying: boolean
  targetCount: number
  difficulty: Difficulty
  send: GameSend
}) {
  const spawnTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const spawnTarget = useCallback(() => {
    send({
      type: 'ADD_TARGET',
      value: Math.floor(Math.random() * (MAX_TARGET + 1)),
      at: Date.now(),
    })
  }, [send])

  const restartCadence = useCallback(() => {
    if (spawnTimer.current) clearInterval(spawnTimer.current)
    spawnTimer.current = setInterval(spawnTarget, DIFFICULTIES[difficulty].spawnInterval)
  }, [spawnTarget, difficulty])

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
