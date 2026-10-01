import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'

import { ARCADE_ROSE_KEY } from '@/constants/storage'
import { readPersisted } from '@/lib/hydration'

// Which way up the arcade map is read, across runs and across launches.
//
// The rose is a reading rather than a setting — see components/game/compass-rose.tsx — but
// which reading a player prefers is theirs, and the screen is torn down at the end of every
// run. Without this, every run opened on the app's preference instead of the player's.
//
// Ahead at the top by default. It is the reading that makes the map a map: the hero's own
// heading is up the screen, the country turns under them as they walk, and the rose is what
// says which way it is now lying. North pinned to the top is the steadier of the two and the
// one a player can ask for, but it is also the one where nothing ever turns — and a sheet
// that never moves is a backdrop rather than a place.

type StoredRose = { northUp?: boolean }

export function usePersistedRose(): {
  northUp: boolean
  setNorthUp: Dispatch<SetStateAction<boolean>>
} {
  const [northUp, setNorthUp] = useState(false)
  // Opened by a read that actually came back, not by one that merely finished: a read that
  // threw knows nothing about what is stored, and writing the default back over it would
  // take the player's choice away on exactly the launch that could not see it.
  const mayPersist = useRef(false)

  useEffect(() => {
    void (async () => {
      const { value, mayPersist: allowed } = await readPersisted<StoredRose>(
        AsyncStorage.getItem.bind(AsyncStorage),
        ARCADE_ROSE_KEY,
      )
      if (typeof value?.northUp === 'boolean') setNorthUp(value.northUp)
      mayPersist.current = allowed
    })()
  }, [])

  useEffect(() => {
    if (!mayPersist.current) return
    AsyncStorage.setItem(ARCADE_ROSE_KEY, JSON.stringify({ northUp })).catch(() => {})
  }, [northUp])

  return { northUp, setNorthUp }
}
