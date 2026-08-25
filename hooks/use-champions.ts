import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'

import { NO_CHAMPIONS, type Champions } from '@/lib/champions'
import { fetchTop5, leaderOf } from '@/lib/leaderboard'
import { SCORED_MODES } from '@/machines/game'

// Who holds each mode's Extreme all-time board.
//
// Two requests — not one per player shown, and not one per run either. Gold is rank
// one, so a champion is whoever leads that board, and knowing the two ids is enough to
// mark every name in the app: a row wears the crown or a bird when its user id is one
// of them.
//
// Deliberately not part of the board store: that store follows the board being looked
// at, and these two boards have to be known whichever board that is.
//
// `refresh` exists because these two ids are otherwise only ever asked for once, on
// mount. Nothing else touches them again, so a player who takes an Extreme all-time
// record mid-session would go on wearing last launch's mark — a stale owl on someone
// who just earned the crown — until they relaunched. The caller's job is to call it
// the moment a run takes an `'ever'` record; see app/(tabs)/index.tsx's game-over
// effect, the one place that already knows a run just did.
export function useChampions(): { champions: Champions; refresh: () => void } {
  const [champions, setChampions] = useState<Champions>(NO_CHAMPIONS)
  // Bumped on every load and unmount, so a slow response cannot land after a newer one.
  const requestIdRef = useRef(0)

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current
    const holders = await Promise.all(
      SCORED_MODES.map(async (mode) => {
        const { rows } = await fetchTop5(mode, 'extreme', 'forever')
        return leaderOf(rows)?.userId ?? null
      }),
    )
    if (requestIdRef.current !== requestId) return
    const [accuracy, speed] = holders
    setChampions({ accuracy: accuracy ?? null, speed: speed ?? null })
  }, [])

  useEffect(() => {
    void load()
    return () => {
      requestIdRef.current++
    }
  }, [load])

  const refresh = useCallback(() => {
    void load()
  }, [load])

  return { champions, refresh }
}

// Held once and read wherever a name is drawn — the board, the pause screen, a
// multiplayer room. A second fetch per surface would ask the same two questions again.
const ChampionsContext = createContext<Champions>(NO_CHAMPIONS)

export const ChampionsProvider = ChampionsContext.Provider

export const useChampionsContext = (): Champions => useContext(ChampionsContext)
