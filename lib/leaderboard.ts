import type { Leader } from '@/lib/announcements'
import { noteRequest } from '@/lib/connectivity'
import {
  tabSince,
  todayISO,
  weekStart,
  type LeaderboardTab,
} from '@/lib/leaderboard-period'
import { supabase } from '@/lib/supabase'
import type { Difficulty, Mode } from '@/machines/game'

export type { LeaderboardTab }

export type LeaderboardRow = {
  rank: number
  user_id: string
  nickname: string
  best_score: number
  hits: number
  // When the record was set — the row's `updated_at`, as an ISO string. Drives the
  // "how long it has stood" mark beside the nickname.
  achieved_at: string
}

export type MyRankRow = {
  rank: number
  total: number
  best_score: number
  hits: number
}

// One board × period standing for the player, straight from the `my_medals` RPC.
export type MyMedalRow = {
  mode: string
  difficulty: string
  period: string
  rank: number
  best_score: number
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

// Who holds a board for one period, as the rival watcher needs it. Read off the board
// the store already fetched rather than asked for separately: the top row of the top
// five is the leader, and a second request for the same fact is a second answer waiting
// to disagree with the first.
//
// The holder matters as much as the score: it is what lets an announcement tell "a
// rival raised the bar" apart from "a rival took your crown".
export const leaderOf = (rows: LeaderboardRow[]): Leader | null => {
  const top = rows[0]
  if (top === undefined) return null
  return { score: top.best_score, userId: top.user_id, nickname: top.nickname }
}

// One row per board × period the player has a score on — the whole medal line in a
// single request. The period bounds go up with the call so the server never has to
// know what "this week" means; see the `my_medals` migration.
export async function fetchMyMedals(
  userId: string,
): Promise<{ rows: MyMedalRow[]; error: string | null }> {
  const today = todayISO()
  const res = await supabase.rpc('my_medals', {
    p_user_id: userId,
    p_today: today,
    p_week_since: weekStart(today),
  })
  noteRequest(res.error)
  if (res.error) return { rows: [], error: res.error.message }
  return { rows: (res.data as MyMedalRow[] | null) ?? [], error: null }
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
