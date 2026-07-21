import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useRef } from 'react'

import { MODE_KEY } from '@/constants/storage'
import { isMode } from '@/lib/is-mode'
import { type GameSend, type Mode } from '@/machines/game'

export function usePersistedMode(mode: Mode, send: GameSend) {
  const hydrated = useRef(false)

  useEffect(() => {
    AsyncStorage.getItem(MODE_KEY)
      .then((raw) => {
        if (raw && isMode(raw)) send({ type: 'SET_MODE', mode: raw })
      })
      .catch(() => {})
      .finally(() => {
        hydrated.current = true
      })
  }, [])

  useEffect(() => {
    if (!hydrated.current) return
    AsyncStorage.setItem(MODE_KEY, mode).catch(() => {})
  }, [mode])
}
