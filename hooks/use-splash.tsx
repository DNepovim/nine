import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { AppState } from 'react-native'

import { useSavedRun } from '@/hooks/use-saved-run'
import { cameStraightBack, noteLeaving } from '@/lib/recent-return'
import { consumeUpdateReload } from '@/lib/update-reload'

type SplashState = {
  // The logo has begun its exit. The screen underneath is already being uncovered, so
  // anything that wants to be the thing revealed has to be running by now — waiting for
  // `done` means being revealed as an empty room and arriving afterwards.
  exiting: boolean
  done: boolean
  beginExit: () => void
  finish: () => void
}

const SplashContext = createContext<SplashState>({
  exiting: false,
  done: false,
  beginExit: () => {},
  finish: () => {},
})

// The intro splash covers the whole app while the screens beneath it are already
// mounted. Anything time-based down there — a target's ring, the welcome run — has to
// wait for this, or it burns through while nobody can see it.
//
// It starts already finished on the two launches that are not really launches.
//
// One is the reload a service-worker update ends in. The other is a home-screen web app
// coming back from a trip to another app, which on iOS is often a killed process and a
// full boot — and the trip the player was sent on was to read a code out of their mail,
// at this app's own asking. Either way the player was looking at the app a moment ago and
// did not ask to go anywhere, so replaying the logo would read as the app having restarted
// itself. Passed as a lazy initialiser rather than called: both notes are read once, on
// the launch that finds them, and neither on a cold start.
export function SplashProvider({ children }: { children: ReactNode }) {
  const [done, setDone] = useState(() => consumeUpdateReload() || cameStraightBack())
  const [exiting, setExiting] = useState(false)

  // The other launch with no logo to play: the app is opening onto a run it was closed
  // on. The player is being handed back a game they were in the middle of, and making
  // them sit through the wordmark first would read as having lost it. `setDone` is
  // sticky, so taking the run a frame later cannot bring the splash back.
  const savedRun = useSavedRun()
  useEffect(() => {
    if (savedRun.pending !== null) setDone(true)
  }, [savedRun.pending])

  // The note itself, left on every departure. Written on `change` rather than on unload:
  // a web app being evicted is not asked whether it minds, and `background` is the last
  // moment anything of ours runs. On native this is a no-op twice over — the stub does
  // nothing, and the process comes back where it was with no splash to skip.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') noteLeaving()
    })
    return () => {
      subscription.remove()
    }
  }, [])

  const beginExit = useCallback(() => {
    setExiting(true)
  }, [])
  const finish = useCallback(() => {
    setDone(true)
  }, [])
  // `|| done` for the launch with no splash to leave — the reload a service-worker update
  // ends in starts already finished, and nothing will ever call beginExit on it.
  const value = useMemo(
    () => ({ exiting: exiting || done, done, beginExit, finish }),
    [exiting, done, beginExit, finish],
  )
  return <SplashContext value={value}>{children}</SplashContext>
}

export function useSplash(): SplashState {
  return use(SplashContext)
}
