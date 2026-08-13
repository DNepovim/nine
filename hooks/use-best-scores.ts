import { useCallback, useEffect, useRef, useState } from 'react'

import { NO_LEADERS, PERIODS, type Leaders, type Period } from '@/lib/announcements'
import { fetchPeriodLeader } from '@/lib/leaderboard'
import type { Difficulty, Mode } from '@/machines/game'

// Which periods are known to hold no score at all. False is the safe answer: it means
// "not established", so a board we could not read is never mistaken for an empty one.
export type EmptyPeriods = Record<Period, boolean>

const NONE_EMPTY: EmptyPeriods = { today: false, week: false, ever: false }

// Who leads each period on one board (mode × difficulty). Fetched on mount and on
// demand via `refresh` — the game screen refreshes between runs, and while a run is in
// progress the rival watcher refreshes it whenever Realtime says the board moved.
export function useBestScores(
  mode: Mode,
  difficulty: Difficulty,
  enabled: boolean,
): {
  leaders: Leaders
  empty: EmptyPeriods
  loaded: boolean
  refresh: () => void
} {
  const [leaders, setLeaders] = useState<Leaders>(NO_LEADERS)
  const [empty, setEmpty] = useState<EmptyPeriods>(NONE_EMPTY)
  // True once the first fetch for this board has settled, however it went — an empty
  // board and three failed requests both count, because callers wait on this to know
  // the numbers are as good as they are going to get, not that they are non-null.
  const [loaded, setLoaded] = useState(false)
  // Bumped on every load, board change and unmount, so a slow response that has been
  // superseded can tell and drop itself.
  const requestIdRef = useRef(0)

  const load = useCallback(async () => {
    const id = ++requestIdRef.current
    const [ever, week, today] = await Promise.all(
      PERIODS.map((period) =>
        fetchPeriodLeader(mode, difficulty, period === 'ever' ? 'forever' : period),
      ),
    )
    if (requestIdRef.current !== id) return
    setLoaded(true)
    // A period counts as empty only when its request came back and brought nothing.
    setEmpty({
      ever: ever?.ok === true && ever.leader === null,
      week: week?.ok === true && week.leader === null,
      today: today?.ok === true && today.leader === null,
    })
    const next: Leaders = {
      ever: ever?.leader ?? null,
      week: week?.leader ?? null,
      today: today?.leader ?? null,
    }
    // All three null means either an untouched board or three failed requests, and the
    // line cannot tell the player which — so keep whatever is on screen instead of
    // blanking one that was already showing real scores. (`empty` above can tell, and
    // is what the opened-a-board announcement reads.)
    if (next.ever === null && next.week === null && next.today === null) return
    setLeaders(next)
  }, [mode, difficulty])

  useEffect(() => {
    if (!enabled) {
      requestIdRef.current++
      setLeaders(NO_LEADERS)
      setEmpty(NONE_EMPTY)
      setLoaded(false)
      return
    }
    // The board changed, so the leaders on screen belong to a different board.
    setLeaders(NO_LEADERS)
    setEmpty(NONE_EMPTY)
    setLoaded(false)
    void load()
    return () => {
      requestIdRef.current++
    }
  }, [enabled, load])

  const refresh = useCallback(() => {
    if (!enabled) return
    void load()
  }, [enabled, load])

  return { leaders, empty, loaded, refresh }
}
