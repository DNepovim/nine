import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useRef } from 'react'

import { MODE_KEY } from '@/constants/storage'
import type { GameSend } from '@/machines/game'
import { isOpenMode, modeById, traitsOf, type ModeId } from '@/modes'

// Whether a stored mode may be dealt again on this launch.
//
// Three ways it may not. A name nothing is registered under — a mode a later build
// removed. A mode on another engine, which is not this machine's run to deal. And a
// **challenge** whose window has closed: its id still resolves, because a player's own
// history still names it, but it is on no list the intro shows, and opening focused on a
// pill that is not there would leave the screen with a difficulty row under nothing.
//
// Any of the three and the launch opens on whatever the machine's own default is, which
// is where every launch used to open.
const playableNow = (raw: string, now: number): boolean => {
  const mode = modeById(raw)
  if (mode === null || traitsOf(raw).engine !== 'targets') return false
  return isOpenMode(mode, now)
}

export function usePersistedMode(mode: ModeId, send: GameSend) {
  const hydrated = useRef(false)

  useEffect(() => {
    AsyncStorage.getItem(MODE_KEY)
      .then((raw) => {
        if (raw !== null && playableNow(raw, Date.now())) {
          send({ type: 'SET_MODE', mode: raw })
        }
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
