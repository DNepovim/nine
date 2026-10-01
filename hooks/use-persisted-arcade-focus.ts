import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useRef, useState } from 'react'

import { ARCADE_FOCUS_KEY } from '@/constants/storage'

// Whether the start screen was last left on the ARCADE pill, across launches.
//
// The three modes come back on their own: the machine's `mode` is persisted, and the pills
// read their focus off it. Arcade is not a mode — it has no place in `MODES` and the
// machine has never heard of it — so the one bit that says "they were on arcade" is kept
// here instead.
//
// Only that bit. Storing the focused pill itself would be a second copy of the mode, free
// to drift from the machine's own the moment anything else in the app changed it.
//
// Same shape as the other persisted hooks: read once on mount, write on every change after
// that. The guard is what stops the write-back racing the read — without it a launch's
// default would be saved over the stored answer before the read came back.
export function usePersistedArcadeFocus(): {
  onArcade: boolean
  setOnArcade: (next: boolean) => void
} {
  const [onArcade, setOnArcade] = useState(false)
  const hydrated = useRef(false)

  useEffect(() => {
    AsyncStorage.getItem(ARCADE_FOCUS_KEY)
      .then((raw) => {
        if (raw === 'true') setOnArcade(true)
      })
      .catch(() => {})
      .finally(() => {
        hydrated.current = true
      })
  }, [])

  useEffect(() => {
    if (!hydrated.current) return
    AsyncStorage.setItem(ARCADE_FOCUS_KEY, String(onArcade)).catch(() => {})
  }, [onArcade])

  return { onArcade, setOnArcade }
}
