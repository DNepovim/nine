import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useRef } from 'react'

import { STATS_KEY } from '@/constants/storage'
import { type GameSend, type Stats } from '@/machines/game'

// Loads persisted per-mode×difficulty stats once on mount and persists on change.
export function usePersistedStats(stats: Stats, send: GameSend) {
  const hydrated = useRef(false)

  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(STATS_KEY)
        if (raw) {
          send({ type: 'HYDRATE_STATS', stats: JSON.parse(raw) as Partial<Stats> })
        }
      } catch {
        // ignore — start fresh
      } finally {
        hydrated.current = true
      }
    })()
  }, [])

  useEffect(() => {
    if (!hydrated.current) return
    AsyncStorage.setItem(STATS_KEY, JSON.stringify(stats)).catch(() => {})
  }, [stats])
}
