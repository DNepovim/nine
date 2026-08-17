import { useEffect, useRef, useState } from 'react'

import {
  readLocalScores,
  subscribeLocalScores,
  type LocalScore,
} from '@/lib/local-scores'

// Every run the device remembers. Re-read whenever the store is written, so a score
// reaches the boards on screen the instant it is made and drops its unpublished mark the
// instant it lands, rather than on the next mount.
export function useLocalScores(): LocalScore[] {
  const [store, setStore] = useState<LocalScore[]>([])
  // Bumped on unmount and on every load, so a read that has been superseded drops
  // itself instead of setting state late.
  const requestIdRef = useRef(0)

  useEffect(() => {
    const load = () => {
      const id = ++requestIdRef.current
      void (async () => {
        const next = await readLocalScores()
        if (requestIdRef.current === id) setStore(next)
      })()
    }
    load()
    const unsubscribe = subscribeLocalScores(load)
    return () => {
      requestIdRef.current++
      unsubscribe()
    }
  }, [])

  return store
}
