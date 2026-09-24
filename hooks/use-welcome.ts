import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useState } from 'react'

import { CAREER_KEY, WELCOME_KEY } from '@/constants/storage'
import {
  NOT_WELCOMED,
  parseWelcome,
  serializeWelcome,
  WELCOMED,
  welcomeLaunch,
  type Welcome,
} from '@/lib/welcome'

const persist = (welcome: Welcome) => {
  AsyncStorage.setItem(WELCOME_KEY, serializeWelcome(welcome)).catch(() => {})
}

// The opening Trainee run: whether this launch owes one, and whether this install ever
// had one.
//
// Read once on mount and never again. A storage failure leaves both answers false, which
// is the safe way round: the player lands on the intro, exactly as they would have before
// any of this, rather than being dropped into a run the app cannot remember giving them.
export function useWelcome(): {
  // Whether storage has answered yet. Until it has, the app knows neither that it owes a
  // run nor that it does not, and painting the intro on the strength of a default would
  // show the start screen to somebody who is about to be dropped into a game.
  decided: boolean
  // A run is owed. True for at most one launch, and only on a device with nothing on it.
  pending: boolean
  // This install opened with the welcome run. Outlives it — see lib/welcome.ts.
  welcomed: boolean
  // Called once the run has actually been started, which is also when it is written down.
  taken: () => void
} {
  const [decided, setDecided] = useState(false)
  const [pending, setPending] = useState(false)
  const [welcomed, setWelcomed] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        // The career store is the history question: it is written when a run ends and
        // never on the way in, so its presence means somebody has actually played here.
        const [raw, career] = await Promise.all([
          AsyncStorage.getItem(WELCOME_KEY),
          AsyncStorage.getItem(CAREER_KEY),
        ])
        const stored = parseWelcome(raw)
        if (welcomeLaunch(stored, career !== null) === 'start') {
          setPending(true)
          return
        }
        setWelcomed(stored?.welcomed ?? false)
        // An install from before the welcome existed answers once and writes it down, so
        // no later launch has to go asking the career about it again.
        if (stored === null) persist(NOT_WELCOMED)
      } catch {
        // ignore — stay on the intro
      } finally {
        // In the finally rather than beside each answer: a read that threw has decided
        // too, and leaving this false would hold the intro back for the whole session.
        setDecided(true)
      }
    })()
  }, [])

  const taken = useCallback(() => {
    setPending(false)
    setWelcomed(true)
    persist(WELCOMED)
  }, [])

  return { decided, pending, welcomed, taken }
}
