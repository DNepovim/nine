import { useCallback, useEffect, useRef, useState } from 'react'

import { fetchMyRank, fetchTop5, type LeaderboardTab } from '@/lib/leaderboard'
import { supabase } from '@/lib/supabase'
import type { Difficulty, Mode } from '@/machines/game'

export type LeaderboardState = {
  rows: ReturnType<typeof fetchTop5> extends Promise<{ rows: infer R }> ? R : never
  myRank: Awaited<ReturnType<typeof fetchMyRank>>['row']
  loading: boolean
  error: string | null
}

// Concrete state shapes used as initial values.
const LOADING: LeaderboardState = { rows: [], myRank: null, loading: true, error: null }
const EMPTY: LeaderboardState = { rows: [], myRank: null, loading: false, error: null }

async function loadTab(
  mode: Mode,
  difficulty: Difficulty,
  tab: LeaderboardTab,
  userId: string | null,
): Promise<LeaderboardState> {
  const [top5, myRankRes] = await Promise.all([
    fetchTop5(mode, difficulty, tab),
    userId
      ? fetchMyRank(userId, mode, difficulty, tab)
      : Promise.resolve({ row: null, error: null }),
  ])
  const error = top5.error ?? myRankRes.error
  if (error) return { rows: [], myRank: null, loading: false, error }
  return { rows: top5.rows, myRank: myRankRes.row, loading: false, error: null }
}

export function useLeaderboard(
  mode: Mode,
  difficulty: Difficulty,
  userId: string | null,
): { today: LeaderboardState; week: LeaderboardState; forever: LeaderboardState } {
  const [today, setToday] = useState<LeaderboardState>(LOADING)
  const [week, setWeek] = useState<LeaderboardState>(LOADING)
  const [forever, setForever] = useState<LeaderboardState>(LOADING)

  const abortedRef = useRef(false)
  const hasDataRef = useRef(false)

  // `showLoading` = true on first load (show skeleton), false on Realtime-triggered
  // re-fetches (silent background refresh so the UI never flickers).
  const fetchAll = useCallback(
    async (showLoading: boolean) => {
      if (showLoading) {
        setToday(LOADING)
        setWeek(LOADING)
        setForever(LOADING)
        hasDataRef.current = false
      }

      const [t, w, f] = await Promise.all([
        loadTab(mode, difficulty, 'today', userId),
        loadTab(mode, difficulty, 'week', userId),
        loadTab(mode, difficulty, 'forever', userId),
      ])

      if (abortedRef.current) return

      const anyError = t.error ?? w.error ?? f.error
      if (!anyError) {
        hasDataRef.current = true
        setToday(t)
        setWeek(w)
        setForever(f)
      } else if (!hasDataRef.current) {
        // First load failed — show the error state.
        setToday(t)
        setWeek(w)
        setForever(f)
      }
      // Silent poll failure when we already have data — keep showing last good rows.
    },
    [mode, difficulty, userId],
  )

  // Stable ref so the Realtime callback always calls the latest fetchAll without
  // needing to tear down and re-create the channel on every render.
  const fetchAllRef = useRef(fetchAll)
  useEffect(() => {
    fetchAllRef.current = fetchAll
  }, [fetchAll])

  useEffect(() => {
    if (mode === 'trainee') {
      setToday(EMPTY)
      setWeek(EMPTY)
      setForever(EMPTY)
      return
    }

    abortedRef.current = false
    hasDataRef.current = false

    void fetchAll(true)

    // One Realtime channel per mode×difficulty board.
    // Row-level filter keeps traffic minimal: only events for this exact board
    // trigger a re-fetch (requires REPLICA IDENTITY FULL on both tables — see
    // migration 20260723000000_enable_realtime.sql).
    const filter = `mode=eq.${mode}&difficulty=eq.${difficulty}`
    const channel = supabase
      .channel(`lb:${mode}:${difficulty}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scores', filter },
        () => {
          void fetchAllRef.current(false)
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_scores', filter },
        () => {
          void fetchAllRef.current(false)
        },
      )
      .subscribe()

    return () => {
      abortedRef.current = true
      void supabase.removeChannel(channel)
    }
  }, [mode, difficulty, userId, fetchAll])

  return { today, week, forever }
}
