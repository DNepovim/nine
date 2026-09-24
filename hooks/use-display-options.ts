import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { BadgeCorner } from '@/components/game/dial-badge'
import {
  DEFAULT_DIAL_CORNERS,
  DIAL_CORNERS,
  DIAL_HINTS,
  TRAINEE_TIMEOUT_MAX_MS,
  TRAINEE_TIMEOUT_MIN_MS,
  type DialCorners,
  type DialHint,
} from '@/constants/dial-hints'
import { OPTIONS_KEY } from '@/constants/storage'
import { readPersisted } from '@/lib/hydration'
import { effectiveTimeout } from '@/machines/game'

type StoredOptions = {
  showSum?: boolean
  showPar?: boolean
  showStats?: boolean
  showRoute?: boolean
  traineeTimeoutMs?: number
  // What each corner shows, stored under the corner's own name. Read field by field
  // below, which is why this needed no new key: a record written by a build that had
  // only `showSum` simply leaves every corner at its default.
  corners?: Partial<Record<BadgeCorner, string | null>>
}

// A stored corner is a plain string until it is checked against the hints this build
// knows. One written by a later build — or by hand — is dropped to the default rather
// than printed as a label nothing can resolve.
const storedHint = (raw: unknown): DialHint | null | undefined => {
  if (raw === null) return null
  return DIAL_HINTS.find((hint) => hint === raw)
}

// Advanced display options (show the button sum), persisted to AsyncStorage, plus which
// number Trainee prints in each corner of a key — see constants/dial-hints.ts.
export function useDisplayOptions() {
  const [showSum, setShowSum] = useState(false)
  // The three below are the rest of what Trainee can print, and all three start off for
  // the same reason the keys do: a first run should be a board, a dial and a target, and
  // every number past that is one the player turns on when they want it explained.
  //
  // The fewest-moves number on each target.
  const [showPar, setShowPar] = useState(false)
  // The HITS / ACCURACY / SPEED row above the board.
  const [showStats, setShowStats] = useState(false)
  // The keys to press for the optimal route, drawn under the coach's line.
  const [showRoute, setShowRoute] = useState(false)
  // Where Trainee's clock starts: exactly what the mode table says, so a player who
  // never touches the slider gets the clock the game was tuned with.
  const [traineeTimeoutMs, setTraineeTimeoutMs] = useState(() =>
    effectiveTimeout('trainee', 'easy'),
  )
  const [corners, setCorners] = useState<DialCorners>(DEFAULT_DIAL_CORNERS)
  // Opened only by a read that actually came back. Setting this in a `finally` — which
  // is what it used to do — meant a read that threw opened the gate exactly as a
  // successful one did, and the next change wrote the default back over whatever the
  // player had chosen. Same defect, same fix, as `use-persisted-stats`.
  const mayPersist = useRef(false)

  useEffect(() => {
    void (async () => {
      const { value, mayPersist: allowed } = await readPersisted<StoredOptions>(
        AsyncStorage.getItem.bind(AsyncStorage),
        OPTIONS_KEY,
      )
      if (typeof value?.showSum === 'boolean') setShowSum(value.showSum)
      if (typeof value?.showPar === 'boolean') setShowPar(value.showPar)
      if (typeof value?.showStats === 'boolean') setShowStats(value.showStats)
      if (typeof value?.showRoute === 'boolean') setShowRoute(value.showRoute)
      // Finite or not at all: a stored NaN would spawn targets that never expire, which
      // is a stuck run rather than a slow one. Held inside the slider's own range too, so
      // a value written by a build with wider ends cannot park the handle off the track.
      const storedMs = value?.traineeTimeoutMs
      if (typeof storedMs === 'number' && Number.isFinite(storedMs)) {
        setTraineeTimeoutMs(
          Math.min(TRAINEE_TIMEOUT_MAX_MS, Math.max(TRAINEE_TIMEOUT_MIN_MS, storedMs)),
        )
      }

      // Per corner rather than wholesale: a stored record missing one — written before
      // that corner existed, or trimmed by hand — takes the default for it instead of
      // dropping every other choice along with it.
      const stored = value?.corners
      if (stored !== undefined) {
        const next: DialCorners = { ...DEFAULT_DIAL_CORNERS }
        for (const corner of DIAL_CORNERS) {
          const hint = storedHint(stored[corner])
          if (hint !== undefined) next[corner] = hint
        }
        setCorners(next)
      }
      mayPersist.current = allowed
    })()
  }, [])

  useEffect(() => {
    if (!mayPersist.current) return
    AsyncStorage.setItem(
      OPTIONS_KEY,
      JSON.stringify({
        showSum,
        showPar,
        showStats,
        showRoute,
        traineeTimeoutMs,
        corners,
      }),
    ).catch(() => {})
  }, [showSum, showPar, showStats, showRoute, traineeTimeoutMs, corners])

  const toggleSum = useCallback(() => {
    setShowSum((value) => !value)
  }, [])

  const togglePar = useCallback(() => {
    setShowPar((value) => !value)
  }, [])

  const toggleStats = useCallback(() => {
    setShowStats((value) => !value)
  }, [])

  const toggleRoute = useCallback(() => {
    setShowRoute((value) => !value)
  }, [])

  const setCorner = useCallback((corner: BadgeCorner, hint: DialHint | null) => {
    setCorners((current) => ({ ...current, [corner]: hint }))
  }, [])

  return {
    showSum,
    toggleSum,
    showPar,
    togglePar,
    showStats,
    toggleStats,
    showRoute,
    toggleRoute,
    traineeTimeoutMs,
    setTraineeTimeoutMs,
    corners,
    setCorner,
  }
}
