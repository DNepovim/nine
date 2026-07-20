import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useRef } from 'react'

import { DIFFICULTY_KEY } from '@/constants/storage'
import { isDifficulty } from '@/lib/is-difficulty'
import { type Difficulty, type GameSend } from '@/machines/game'

// Restores the last chosen difficulty on mount (the machine starts in `menu`,
// where SET_DIFFICULTY is handled) and persists it when it changes.
export function usePersistedDifficulty(difficulty: Difficulty, send: GameSend) {
  const hydrated = useRef(false)

  useEffect(() => {
    AsyncStorage.getItem(DIFFICULTY_KEY)
      .then((raw) => {
        if (raw && isDifficulty(raw)) send({ type: 'SET_DIFFICULTY', difficulty: raw })
      })
      .catch(() => {})
      .finally(() => {
        hydrated.current = true
      })
  }, [])

  useEffect(() => {
    if (!hydrated.current) return
    AsyncStorage.setItem(DIFFICULTY_KEY, difficulty).catch(() => {})
  }, [difficulty])
}
