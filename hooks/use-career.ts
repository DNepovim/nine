import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useRef, useState } from 'react'

import { CAREER_KEY } from '@/constants/storage'
import { emptyCareer, type Career } from '@/lib/career'
import { readPersisted } from '@/lib/hydration'

// The player's lifetime totals, loaded once and written back on every change.
//
// Shaped like `usePersistedStats` rather than like the machine: nothing in a run reads
// the career, so it has no business in the machine's context — only the achievements ask
// it anything, and they ask once per run.
//
// `update` takes a reducer rather than a value so a caller never has to hold a stale copy
// to fold into; the write happens off the state that was actually current.
export function useCareer(): {
  career: Career
  // Whether the stored career has been read yet. Until it has, every total reads zero,
  // and an achievement measured against zero would unlock on the first hit of the first
  // run after a cold start — for a player who earned it months ago.
  loaded: boolean
  update: (fold: (career: Career) => Career) => void
} {
  const [career, setCareer] = useState<Career>(emptyCareer)
  const [loaded, setLoaded] = useState(false)
  // Opened only by a read that actually came back. A read that failed knows nothing about
  // the player's history, and writing on the strength of it replaces that history with
  // zeroes — see hydrateFrom. Losing this store is worse than losing a best score: a best
  // can be set again in one run, and a year of days played cannot.
  const mayPersist = useRef(false)

  useEffect(() => {
    void (async () => {
      const hydration = await readPersisted<Career>(
        AsyncStorage.getItem.bind(AsyncStorage),
        CAREER_KEY,
      )
      // Spread over the defaults rather than trusted whole: a store written by an older
      // build is missing whatever has been added since, and a missing counter must read
      // as zero rather than as undefined.
      if (hydration.value !== null) {
        setCareer({ ...emptyCareer(), ...hydration.value })
      }
      mayPersist.current = hydration.mayPersist
      setLoaded(true)
    })()
  }, [])

  const update = useCallback((fold: (career: Career) => Career) => {
    setCareer((current) => {
      const next = fold(current)
      if (next === current) return current
      if (mayPersist.current) {
        AsyncStorage.setItem(CAREER_KEY, JSON.stringify(next)).catch(() => {})
      }
      return next
    })
  }, [])

  return { career, loaded, update }
}
