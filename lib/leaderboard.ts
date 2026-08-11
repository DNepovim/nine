import type { Leader } from '@/lib/announcements'
import { tabSince, todayISO, type LeaderboardTab } from '@/lib/leaderboard-period'
import { supabase } from '@/lib/supabase'
import type { Difficulty, Mode } from '@/machines/game'

export type { LeaderboardTab }

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

const tabToSince = (tab: LeaderboardTab): string | null => tabSince(tab, todayISO())

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

// Who holds a board for one period, and with what — the same `leaderboard` RPC as the
// full table, asked for one row. Returns null when the board is empty or the request
// fails; callers render both as "no value" rather than an error.
//
// The holder matters as much as the score: it is what lets an announcement tell "a
// rival raised the bar" apart from "a rival took your crown".
export async function fetchPeriodLeader(
  mode: Mode,
  difficulty: Difficulty,
  tab: LeaderboardTab,
): Promise<Leader | null> {
  const res = await supabase.rpc('leaderboard', {
    p_mode: mode,
    p_difficulty: difficulty,
    p_limit: 1,
    p_since: tabToSince(tab),
  })
  if (res.error) return null
  const rows = (res.data as LeaderboardRow[] | null) ?? []
  const top = rows[0]
  if (top === undefined) return null
  return { score: top.best_score, userId: top.user_id, nickname: top.nickname }
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
