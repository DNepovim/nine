import { useCallback, useEffect, useState } from 'react'

import type { ScreenControl } from '@/hooks/use-run-control'
import { isMode, MODE_ORDER, type Mode } from '@/modes'

// The beat between the countdown going red and the run ending. Long enough that the red is
// read as the reason rather than as a flicker on the way to the game-over screen, and short
// enough that it cannot be mistaken for time the player still has.
const EXPIRED_GRACE_MS = 1000
// Which **session** the live run belongs to, and what that run owes it: the places asked
// for again as it ends, the window shutting under it, and the intro put back on a mode it
// offers once the run's claim is over.
export function useRunSession({ control }: { control: ScreenControl }) {
  const {
    isMenu,
    isPlaying,
    mode,
    runSession,
    send,
    setRunSession,
    setWindowShut,
    windowShut,
  } = control
  // Bumped as a session run ends, to read the player's places and firsts again — see
  // useSessionPlaces.
  const [placesAsked, setPlacesAsked] = useState(0)

  // The strip reaching the boundary. One setter, so the colour and the end are two readers
  // of one moment rather than two clocks that could disagree.
  const handleWindowShut = useCallback(() => {
    setWindowShut(true)
  }, [])

  // Red, then over. The strip fires the boundary and this is the second half of it.
  //
  // Guarded on `isPlaying` rather than merely on the flag, because the strip announces on
  // a mount that is already past the close — a run resumed after the window shut does
  // exactly that — and because the machine ignores `EXPIRE` anywhere but `playing`, a send
  // that arrives while paused is dropped and has to arrive again on the resume. The timer
  // is cleared on unmount so it cannot land in a run that has since restarted.
  useEffect(() => {
    if (!windowShut || !isPlaying) return
    const timer = setTimeout(() => {
      send({ type: 'EXPIRE', now: Date.now() })
    }, EXPIRED_GRACE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [windowShut, isPlaying, send])

  // The mode the player was on before a challenge interrupted it, so the intro can be
  // put back the way they left it. Null whenever the machine is already on one of its
  // own modes, which is every moment but a challenge run.
  const [modeBeforeSession, setModeBeforeSession] = useState<Mode | null>(null)

  // Reaching the intro ends a run's claim on its session, and puts the machine back on a
  // mode the intro actually offers.
  //
  // The second half is not tidiness. Challenges left the pill row when they got a card of
  // their own, so after a challenge run `mode` is a name `ModeSelector` cannot find: the
  // highlight stays on whichever pill it last lit, the difficulty row and the board
  // vanish — `usesDifficulty` and `SCORED_MODES` are both false for a challenge — and
  // PLAY GAME, which reads the machine's mode, deals *another* challenge run belonging to
  // no session at all. `isMode` is the registry's own word for "one of the three the
  // intro lists", so this asks the question rather than guessing at a name.
  //
  // The doors that start a fresh run in the same breath clear the session themselves — a
  // value the next run reads has to be right before that run is dealt, not a render later
  // — and this is the backstop for every other way out, including ones nobody has
  // written yet. Guarded on the values already being settled, since `isMenu` is true for
  // the whole time the player stands on the intro.
  useEffect(() => {
    if (!isMenu) return
    if (runSession !== null) {
      setRunSession(null)
      // The run just posted to its session, and may have been the first score there.
      setPlacesAsked((asked) => asked + 1)
    }
    // A shut window belongs to the run it shut on. Reaching the intro is the end of that
    // run's claim on it, exactly as it is the end of its claim on the session itself.
    if (windowShut) setWindowShut(false)
    // Where they were, or the first pill the intro lists. `MODE_ORDER` rather than a
    // name typed here: nothing outside `modes/` gets to decide which mode is the default.
    const back = modeBeforeSession ?? MODE_ORDER[0]
    if (!isMode(mode) && back !== undefined) send({ type: 'SET_MODE', mode: back })
  }, [isMenu, runSession, windowShut, mode, modeBeforeSession, send])

  return { handleWindowShut, placesAsked, setModeBeforeSession }
}

export type ScreenSession = ReturnType<typeof useRunSession>
