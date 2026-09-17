import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useRef } from 'react'

import { STATS_KEY } from '@/constants/storage'
import { readPersisted } from '@/lib/hydration'
import { type GameSend, type Stats } from '@/machines/game'

// Loads persisted per-mode×difficulty stats once on mount and persists on change.
export function usePersistedStats(stats: Stats, send: GameSend) {
  // Opened only by a read that actually came back. A read that failed knows nothing
  // about the player's history, and writing on the strength of it replaces that history
  // with the machine's defaults — see hydrateFrom.
  const mayPersist = useRef(false)

  useEffect(() => {
    void (async () => {
      const hydration = await readPersisted<Partial<Stats>>(
        AsyncStorage.getItem.bind(AsyncStorage),
        STATS_KEY,
      )
      if (hydration.value !== null) {
        send({ type: 'HYDRATE_STATS', stats: hydration.value })
      }
      mayPersist.current = hydration.mayPersist
    })()
  }, [])

  useEffect(() => {
    if (!mayPersist.current) return
    AsyncStorage.setItem(STATS_KEY, JSON.stringify(stats)).catch(() => {})
  }, [stats])
}
