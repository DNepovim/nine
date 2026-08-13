import type { Leader } from '@/lib/announcements'
import { noteRequest } from '@/lib/connectivity'
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
  // Every board read doubles as a reachability probe — this is the request the app
  // makes most often, so it is what notices a connection coming back.
  noteRequest(res.error)
  if (res.error) return { rows: [], error: res.error.message }
  return { rows: (res.data as LeaderboardRow[] | null) ?? [], error: null }
}

// Who holds a board for one period, and with what — the same `leaderboard` RPC as the
// full table, asked for one row.
//
// `ok` separates the two reasons a leader can be missing. A leaderboard line renders
// both as "no value", but the announcement that says you opened a board must not fire
// on a board we merely failed to read: `leader === null && ok` is an empty board,
// `!ok` is a board we know nothing about.
//
// The holder matters as much as the score: it is what lets an announcement tell "a
// rival raised the bar" apart from "a rival took your crown".
export async function fetchPeriodLeader(
  mode: Mode,
  difficulty: Difficulty,
  tab: LeaderboardTab,
): Promise<{ leader: Leader | null; ok: boolean }> {
  const res = await supabase.rpc('leaderboard', {
    p_mode: mode,
    p_difficulty: difficulty,
    p_limit: 1,
    p_since: tabToSince(tab),
  })
  noteRequest(res.error)
  if (res.error) return { leader: null, ok: false }
  const rows = (res.data as LeaderboardRow[] | null) ?? []
  const top = rows[0]
  if (top === undefined) return { leader: null, ok: true }
  return {
    leader: { score: top.best_score, userId: top.user_id, nickname: top.nickname },
    ok: true,
  }
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
  noteRequest(res.error)
  if (res.error) return { row: null, error: res.error.message }
  const rows = (res.data as MyRankRow[] | null) ?? []
  return { row: rows[0] ?? null, error: null }
}
