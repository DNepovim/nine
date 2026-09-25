import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { RUN_KEY } from '@/constants/storage'
import { readPersisted } from '@/lib/hydration'
import { parseSavedRun, type SavedRun } from '@/lib/saved-run'

type SavedRunState = {
  // Whether storage has answered yet. Until it has, the app knows neither that it owes
  // the player a run nor that it does not — and both the splash and the intro would be
  // showing something on the strength of a default.
  probing: boolean
  // A run waiting to be put back, or null. Non-null for at most the few frames between
  // storage answering and the machine taking it.
  pending: SavedRun | null
  // Nothing is on its way in: storage has answered and whatever it had has been taken.
  // What every screen that paints the intro, and everything that writes this key, waits
  // for — clearing the key before the probe has spoken is how the run would be thrown
  // away on the very launch meant to hand it back.
  settled: boolean
  // Called once the machine has the run.
  taken: () => void
}

const SavedRunContext = createContext<SavedRunState>({
  probing: false,
  pending: null,
  settled: true,
  taken: () => {},
})

// The run the last session was closed on, asked for once per launch.
//
// A provider rather than a hook because two very different places need the same answer
// before anything is drawn: the splash, which must not replay the logo for a player who
// is being handed back a game in progress, and the game screen, which is the one that
// actually puts it back. Asking twice would let them disagree.
//
// A read that threw leaves `pending` null, which is the safe way round — the player
// lands on the intro, exactly as every launch did before any of this.
export function SavedRunProvider({ children }: { children: ReactNode }) {
  const [probing, setProbing] = useState(true)
  const [pending, setPending] = useState<SavedRun | null>(null)

  useEffect(() => {
    void (async () => {
      const hydration = await readPersisted<unknown>(
        AsyncStorage.getItem.bind(AsyncStorage),
        RUN_KEY,
      )
      setPending(parseSavedRun(hydration.value))
      setProbing(false)
    })()
  }, [])

  const taken = useCallback(() => {
    setPending(null)
  }, [])

  const value = useMemo(
    () => ({ probing, pending, settled: !probing && pending === null, taken }),
    [probing, pending, taken],
  )
  return <SavedRunContext value={value}>{children}</SavedRunContext>
}

export function useSavedRun(): SavedRunState {
  return use(SavedRunContext)
}
