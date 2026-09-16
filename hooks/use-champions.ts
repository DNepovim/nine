import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'

import { subscribeBoards } from '@/lib/board-live'
import {
  mergeChampions,
  NO_CHAMPIONS,
  type ChampionRead,
  type Champions,
} from '@/lib/champions'
import { fetchTop5, leaderOf } from '@/lib/leaderboard'
import { SCORED_MODES } from '@/machines/game'

// A run touches both of these boards at most once, and two requests answer for both.
// Long enough to collect the pair of events one submit makes — the write to
// `daily_scores` and the rollup's write to `scores` — since this mark is never
// mid-run urgent.
const COALESCE_MS = 800

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
// Kept current off the app's one board connection, the same way the medal line is.
// Asking once on mount was not enough — a player who took an Extreme all-time record
// mid-session would go on wearing last launch's mark, a stale owl on someone who had
// just earned the crown. Refetching from the game-over effect instead was worse than
// it looked: it fired alongside the submit rather than after it, so the read raced the
// write and reliably came back without the very record that triggered it. Realtime has
// no such gap — the event *is* the write landing — and it covers the two things the
// game-over hook never could: a rival taking a board while we watch, and a
// reconnection after time asleep.
export function useChampions(): Champions {
  const [champions, setChampions] = useState<Champions>(NO_CHAMPIONS)
  // Bumped on every load and unmount, so a slow response cannot land after a newer one.
  const requestIdRef = useRef(0)

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current
    const reads = await Promise.all(
      SCORED_MODES.map(async (mode): Promise<ChampionRead> => {
        const { rows, error } = await fetchTop5(mode, 'extreme', 'forever')
        // A board we could not read says nothing about who holds it. Reporting that as
        // "nobody" would take the mark off a champion over one dropped request.
        if (error !== null) return undefined
        return leaderOf(rows)?.userId ?? null
      }),
    )
    if (requestIdRef.current !== requestId) return
    const [accuracy, speed] = reads
    setChampions((prev) => mergeChampions(prev, { accuracy, speed }))
  }, [])

  useEffect(() => {
    void load()

    // Only the two Extreme boards decide a champion. The other four move far more
    // often — every Easy run anyone plays — and refetching for them would ask these
    // two questions again to get the same two answers.
    let coalesce: ReturnType<typeof setTimeout> | undefined
    const unsubscribe = subscribeBoards((moved) => {
      // A move we cannot attribute is a gap we cannot see into, so it always counts.
      if (moved !== null && moved.difficulty !== 'extreme') return
      clearTimeout(coalesce)
      coalesce = setTimeout(() => void load(), COALESCE_MS)
    })

    return () => {
      requestIdRef.current++
      clearTimeout(coalesce)
      unsubscribe()
    }
  }, [load])

  return champions
}

// Held once and read wherever a name is drawn — the board, the pause screen, a
// multiplayer room. A second fetch per surface would ask the same two questions again.
const ChampionsContext = createContext<Champions>(NO_CHAMPIONS)

export const ChampionsProvider = ChampionsContext.Provider

export const useChampionsContext = (): Champions => useContext(ChampionsContext)
