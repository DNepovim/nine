import { useEffect, useRef, useState } from 'react'

import {
  readPendingScores,
  subscribePendingScores,
  type PendingScore,
} from '@/lib/pending-scores'

// The player's unsynced records, for showing them on the board with a mark and for
// knowing there is something to publish.
//
// Re-read whenever the queue is written, so the local rows disappear the instant the
// flush lands them on the server rather than on the next mount.
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
    const load = () => {
      const id = ++requestIdRef.current
      void (async () => {
        const pending = await readPendingScores()
        if (requestIdRef.current === id) setQueue(pending)
      })()
    }
    load()
    const unsubscribe = subscribePendingScores(load)
    return () => {
      requestIdRef.current++
      unsubscribe()
    }
  }, [enabled])

  return queue
}
