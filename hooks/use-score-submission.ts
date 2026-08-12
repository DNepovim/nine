import { isNonEmptyArray } from 'narrowland'
import { useCallback, useEffect } from 'react'
import { AppState } from 'react-native'

import { useOnline } from '@/hooks/use-online'
import { usePendingScores } from '@/hooks/use-pending-scores'
import { flushPendingScores, submitScore } from '@/lib/score-submission'
import type { Difficulty, Mode } from '@/machines/game'

// How often a stranded queue tries again while the connection is down. Each attempt is
// also the probe that notices the connection came back, so it is slow enough to cost
// nothing and quick enough that a player rarely sees a stale board.
const RETRY_MS = 30_000

export function useScoreSubmission(
  userId: string | null,
  nickname: string | null,
  isReady: boolean,
) {
  const online = useOnline()
  const hasPending = isNonEmptyArray(usePendingScores(true))

  // Publishing is possible the moment there is a nickname, and the queue is drained
  // then and there — that first flush is what moves a player's local records onto the
  // server and clears them off the device. After that the same effect covers the other
  // way records pile up: a run played offline, retried until the connection returns.
  useEffect(() => {
    if (!isReady || userId === null || nickname === null || !hasPending) return

    const flush = () => {
      void flushPendingScores(userId, nickname)
    }
    flush()

    // Online and still holding records means the server refused them, not that the
    // line is down — retrying on a timer would only repeat the refusal.
    if (online) return

    const timer = setInterval(flush, RETRY_MS)
    // A phone that regained signal while backgrounded has nothing else to announce it.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') flush()
    })
    return () => {
      clearInterval(timer)
      subscription.remove()
    }
  }, [isReady, userId, nickname, hasPending, online])

  const submit = useCallback(
    (mode: Mode, difficulty: Difficulty, score: number, hits: number) => {
      void submitScore(userId, nickname, mode, difficulty, score, hits)
    },
    [userId, nickname],
  )

  return { submit }
}
