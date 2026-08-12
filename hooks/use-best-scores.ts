import { useCallback, useEffect, useRef, useState } from 'react'

import { NO_LEADERS, PERIODS, type Leaders } from '@/lib/announcements'
import { fetchPeriodLeader } from '@/lib/leaderboard'
import type { Difficulty, Mode } from '@/machines/game'

// Who leads each period on one board (mode × difficulty). Fetched on mount and on
// demand via `refresh` — the game screen refreshes between runs, and while a run is in
// progress the rival watcher refreshes it whenever Realtime says the board moved.
export function useBestScores(
  mode: Mode,
  difficulty: Difficulty,
  enabled: boolean,
): { leaders: Leaders; loaded: boolean; refresh: () => void } {
  const [leaders, setLeaders] = useState<Leaders>(NO_LEADERS)
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
    // All three null means either an untouched board or three failed requests, and we
    // cannot tell which — so keep whatever is on screen instead of blanking a line that
    // was already showing real scores.
    if (ever === null && week === null && today === null) return
    setLeaders({ ever: ever ?? null, week: week ?? null, today: today ?? null })
  }, [mode, difficulty])

  useEffect(() => {
    if (!enabled) {
      requestIdRef.current++
      setLeaders(NO_LEADERS)
      setLoaded(false)
      return
    }
    // The board changed, so the leaders on screen belong to a different board.
    setLeaders(NO_LEADERS)
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

  return { leaders, loaded, refresh }
}
