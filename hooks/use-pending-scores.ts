import { useEffect, useRef, useState } from 'react'

import { readPendingScores, type PendingScore } from '@/lib/pending-scores'

// The player's unpublished runs, for showing them on the board with a mark.
//
// Only meaningful while there is no nickname: the moment one exists,
// flushPendingScores drains the queue onto the server and the real rows take over,
// so callers pass `enabled: nickname === null` and never have to race the flush.
export function usePendingScores(enabled: boolean): PendingScore[] {
  const [queue, setQueue] = useState<PendingScore[]>([])
  // Bumped on unmount and on every load, so a read that has been superseded drops
  // itself instead of setting state late.
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (!enabled) {
      requestIdRef.current++
      setQueue([])
      return
    }
    const id = ++requestIdRef.current
    void (async () => {
      const pending = await readPendingScores()
      if (requestIdRef.current === id) setQueue(pending)
    })()
    return () => {
      requestIdRef.current++
    }
  }, [enabled])

  return queue
}
