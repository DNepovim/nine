import { useCallback, useEffect, useRef, useState } from 'react'

import { fetchPeriodBest } from '@/lib/leaderboard'
import type { Difficulty, Mode } from '@/machines/game'

export type PeriodBests = {
  today: number | null
  week: number | null
  ever: number | null
}

const EMPTY: PeriodBests = { today: null, week: null, ever: null }

// Top score per leaderboard period for one board (mode × difficulty). Fetched on
// mount and on demand via `refresh` — deliberately not Realtime-subscribed, so a
// run is never interrupted by network work on the screen where the frame budget
// matters most.
export function useBestScores(
  mode: Mode,
  difficulty: Difficulty,
  enabled: boolean,
): PeriodBests & { refresh: () => void } {
  const [bests, setBests] = useState<PeriodBests>(EMPTY)
  // Bumped on every load, board change and unmount, so a slow response that has
  // been superseded can tell and drop itself.
  const requestIdRef = useRef(0)

  const load = useCallback(async () => {
    const id = ++requestIdRef.current
    const [today, week, ever] = await Promise.all([
      fetchPeriodBest(mode, difficulty, 'today'),
      fetchPeriodBest(mode, difficulty, 'week'),
      fetchPeriodBest(mode, difficulty, 'forever'),
    ])
    if (requestIdRef.current !== id) return
    // Three nulls means either an untouched board or three failed requests, and
    // we cannot tell which — so keep whatever is on screen instead of blanking a
    // line that was already showing real scores.
    if (today === null && week === null && ever === null) return
    setBests({ today, week, ever })
  }, [mode, difficulty])

  useEffect(() => {
    if (!enabled) {
      requestIdRef.current++
      setBests(EMPTY)
      return
    }
    // The board changed, so the numbers on screen belong to a different board —
    // clear to dashes rather than showing them against the new one.
    setBests(EMPTY)
    void load()
    return () => {
      requestIdRef.current++
    }
  }, [enabled, load])

  const refresh = useCallback(() => {
    if (!enabled) return
    void load()
  }, [enabled, load])

  return { ...bests, refresh }
}
