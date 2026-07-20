import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useRef } from 'react'

import { LEGACY_BEST_SCORES_KEY, STATS_KEY } from '@/constants/storage'
import { DIFFICULTY_ORDER, type GameSend, type Stats } from '@/machines/game'

// Loads persisted per-difficulty stats once on mount (migrating the legacy
// hit-count key into the new {score, hits} shape) and persists them on change.
export function usePersistedStats(stats: Stats, send: GameSend) {
  const hydrated = useRef(false)

  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(STATS_KEY)
        if (raw) {
          send({ type: 'HYDRATE_STATS', stats: JSON.parse(raw) as Partial<Stats> })
          return
        }
        const legacy = await AsyncStorage.getItem(LEGACY_BEST_SCORES_KEY)
        if (legacy) {
          const old = JSON.parse(legacy) as Record<string, number | undefined>
          const seeded: Partial<Stats> = {}
          for (const difficulty of DIFFICULTY_ORDER) {
            const hits = old[difficulty]
            if (typeof hits === 'number') seeded[difficulty] = { score: 0, hits }
          }
          send({ type: 'HYDRATE_STATS', stats: seeded })
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
