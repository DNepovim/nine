import { useEffect, useRef, useState } from 'react'

import {
  fetchMyRank,
  fetchTop5,
  type LeaderboardRow,
  type LeaderboardTab,
  type MyRankRow,
} from '@/lib/leaderboard'
import type { Difficulty, Mode } from '@/machines/game'

type LeaderboardState = {
  rows: LeaderboardRow[]
  myRank: MyRankRow | null
  loading: boolean
  error: string | null
}

// Per-session in-memory cache — avoids redundant RPCs while the modal is open.
const cache = new Map<string, { rows: LeaderboardRow[]; myRank: MyRankRow | null }>()

function useSingleTab(
  mode: Mode,
  difficulty: Difficulty,
  tab: LeaderboardTab,
  userId: string | null,
): LeaderboardState {
  const [state, setState] = useState<LeaderboardState>({
    rows: [],
    myRank: null,
    loading: true,
    error: null,
  })
  const abortedRef = useRef(false)

  useEffect(() => {
    if (mode === 'trainee') {
      setState({ rows: [], myRank: null, loading: false, error: null })
      return
    }

    const key = `${tab}:${mode}:${difficulty}:${userId ?? 'anon'}`
    const hit = cache.get(key)
    if (hit) {
      setState({ rows: hit.rows, myRank: hit.myRank, loading: false, error: null })
      return
    }

    abortedRef.current = false
    setState((s) => ({ ...s, loading: true, error: null }))

    void (async () => {
      const [top5, myRankRes] = await Promise.all([
        fetchTop5(mode, difficulty, tab),
        userId
          ? fetchMyRank(userId, mode, difficulty, tab)
          : Promise.resolve({ row: null, error: null }),
      ])

      if (abortedRef.current) return

      const error = top5.error ?? myRankRes.error
      cache.set(key, { rows: top5.rows, myRank: myRankRes.row })
      setState({ rows: top5.rows, myRank: myRankRes.row, loading: false, error })
    })()

    return () => {
      abortedRef.current = true
    }
  }, [mode, difficulty, tab, userId])

  return state
}

export type { LeaderboardState }

export function useLeaderboard(
  mode: Mode,
  difficulty: Difficulty,
  userId: string | null,
): { today: LeaderboardState; week: LeaderboardState; forever: LeaderboardState } {
  const today = useSingleTab(mode, difficulty, 'today', userId)
  const week = useSingleTab(mode, difficulty, 'week', userId)
  const forever = useSingleTab(mode, difficulty, 'forever', userId)
  return { today, week, forever }
}
