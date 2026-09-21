import type { Leader } from '@/lib/announcements'
import { noteRequest } from '@/lib/connectivity'
import {
  previousDay,
  previousWeek,
  tabSince,
  todayISO,
  weekStart,
  type LeaderboardTab,
} from '@/lib/leaderboard-period'
import type { Winner } from '@/lib/recent-winners'
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

// One closed window's winner, as the `past_winners` RPC returns it. `period` is the
// window it answers for — 'yesterday' or 'last_week'.
type PastWinnerRow = {
  period: string
  user_id: string
  nickname: string
  best_score: number
}

export type PastWinners = {
  yesterday: Winner | null
  lastWeek: Winner | null
}

export const NO_PAST_WINNERS: PastWinners = { yesterday: null, lastWeek: null }

const winnerIn = (rows: PastWinnerRow[], period: string): Winner | null => {
  const row = rows.find((r) => r.period === period)
  if (row === undefined) return null
  return { userId: row.user_id, nickname: row.nickname }
}

// Who took this board yesterday, and who took it last week.
//
// Both windows in one request, and both bounds computed here on the Prague clock, so
// the two sentences of the stripe can never be drawn from two different ideas of when
// yesterday was. A window nobody played comes back absent, which reads as null.
export async function fetchPastWinners(
  mode: Mode,
  difficulty: Difficulty,
): Promise<{ winners: PastWinners; error: string | null }> {
  const today = todayISO()
  const week = previousWeek(today)
  const res = await supabase.rpc('past_winners', {
    p_mode: mode,
    p_difficulty: difficulty,
    p_yesterday: previousDay(today),
    p_week_from: week.from,
    p_week_to: week.to,
  })
  noteRequest(res.error)
  if (res.error) return { winners: NO_PAST_WINNERS, error: res.error.message }
  const rows = (res.data as PastWinnerRow[] | null) ?? []
  return {
    winners: {
      yesterday: winnerIn(rows, 'yesterday'),
      lastWeek: winnerIn(rows, 'last_week'),
    },
    error: null,
  }
}
