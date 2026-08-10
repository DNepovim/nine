import { supabase } from '@/lib/supabase'
import type { Difficulty, Mode } from '@/machines/game'

export type LeaderboardRow = {
  rank: number
  user_id: string
  nickname: string
  best_score: number
  hits: number
}

export type MyRankRow = {
  rank: number
  total: number
  best_score: number
  hits: number
}

export type LeaderboardTab = 'today' | 'week' | 'forever'

function tabToSince(tab: LeaderboardTab): string | null {
  if (tab === 'forever') return null
  const d = new Date()
  if (tab === 'week') d.setDate(d.getDate() - 6)
  return d.toISOString().slice(0, 10)
}

export async function fetchTop5(
  mode: Mode,
  difficulty: Difficulty,
  tab: LeaderboardTab,
): Promise<{ rows: LeaderboardRow[]; error: string | null }> {
  const res = await supabase.rpc('leaderboard', {
    p_mode: mode,
    p_difficulty: difficulty,
    p_limit: 5,
    p_since: tabToSince(tab),
  })
  if (res.error) return { rows: [], error: res.error.message }
  return { rows: (res.data as LeaderboardRow[] | null) ?? [], error: null }
}

// The single top score on a board for one period — the same `leaderboard` RPC as
// the full table, asked for one row. Returns null when the board is empty or the
// request fails; callers render both as "no value" rather than an error.
export async function fetchPeriodBest(
  mode: Mode,
  difficulty: Difficulty,
  tab: LeaderboardTab,
): Promise<number | null> {
  const res = await supabase.rpc('leaderboard', {
    p_mode: mode,
    p_difficulty: difficulty,
    p_limit: 1,
    p_since: tabToSince(tab),
  })
  if (res.error) return null
  const rows = (res.data as LeaderboardRow[] | null) ?? []
  return rows[0]?.best_score ?? null
}

export async function fetchMyRank(
  userId: string,
  mode: Mode,
  difficulty: Difficulty,
  tab: LeaderboardTab,
): Promise<{ row: MyRankRow | null; error: string | null }> {
  const res = await supabase.rpc('my_rank', {
    p_user_id: userId,
    p_mode: mode,
    p_difficulty: difficulty,
    p_since: tabToSince(tab),
  })
  if (res.error) return { row: null, error: res.error.message }
  const rows = (res.data as MyRankRow[] | null) ?? []
  return { row: rows[0] ?? null, error: null }
}
