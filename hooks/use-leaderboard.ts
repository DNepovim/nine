import { useEffect, useRef, useState } from 'react'

import {
  fetchMyRank,
  fetchTop5,
  type LeaderboardRow,
  type LeaderboardTab,
  type MyRankRow,
} from '@/lib/leaderboard'
import type { Difficulty, Mode } from '@/machines/game'

export type LeaderboardState = {
  rows: LeaderboardRow[]
  myRank: MyRankRow | null
  loading: boolean
  error: string | null
}

const POLL_MS = 30_000

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
  const hasDataRef = useRef(false)
  const abortedRef = useRef(false)

  useEffect(() => {
    if (mode === 'trainee') {
      setState({ rows: [], myRank: null, loading: false, error: null })
      return
    }

    abortedRef.current = false
    hasDataRef.current = false
    setState({ rows: [], myRank: null, loading: true, error: null })

    const fetchData = async () => {
      const [top5, myRankRes] = await Promise.all([
        fetchTop5(mode, difficulty, tab),
        userId
          ? fetchMyRank(userId, mode, difficulty, tab)
          : Promise.resolve({ row: null, error: null }),
      ])

      if (abortedRef.current) return

      const error = top5.error ?? myRankRes.error

      if (!error) {
        hasDataRef.current = true
        setState({ rows: top5.rows, myRank: myRankRes.row, loading: false, error: null })
      } else if (!hasDataRef.current) {
        // First load failed — show the error/offline state
        setState({ rows: [], myRank: null, loading: false, error })
      }
      // Polling failures when we already have data are silent — keep showing last good rows
    }

    void fetchData()
    const id = setInterval(() => {
      void fetchData()
    }, POLL_MS)

    return () => {
      abortedRef.current = true
      clearInterval(id)
    }
  }, [mode, difficulty, tab, userId])

  return state
}

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
