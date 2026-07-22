import { useCallback, useEffect, useRef } from 'react'

import { flushPendingScores, submitScore } from '@/lib/score-submission'
import type { Difficulty, Mode } from '@/machines/game'

export function useScoreSubmission(
  userId: string | null,
  nickname: string | null,
  isReady: boolean,
) {
  const flushedRef = useRef(false)

  useEffect(() => {
    if (!isReady || !userId || !nickname || flushedRef.current) return
    flushedRef.current = true
    void flushPendingScores(userId, nickname)
  }, [isReady, userId, nickname])

  const submit = useCallback(
    (mode: Mode, difficulty: Difficulty, score: number, hits: number) => {
      void submitScore(userId, nickname, mode, difficulty, score, hits)
    },
    [userId, nickname],
  )

  return { submit }
}
