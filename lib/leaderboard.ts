import { isEmptyArray, isOneOf } from 'narrowland'

import type { Leader } from '@/lib/announcements'
import { noteRequest } from '@/lib/connectivity'
import { isDifficulty } from '@/lib/is-difficulty'
import {
  nextDay,
  previousDay,
  previousWeek,
  tabSince,
  todayISO,
  weekStart,
  type LeaderboardTab,
} from '@/lib/leaderboard-period'
import {
  shapeProfile,
  type PlayerProfile,
  type PlayerProfileResponse,
} from '@/lib/player-profile'
import type { Winner } from '@/lib/recent-winners'
import { supabase } from '@/lib/supabase'
import { WIN_PERIODS, type Award } from '@/lib/winnings'
import { SCORED_MODES, type Difficulty, type Mode } from '@/machines/game'

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
  // The player's lifetime factor averages, which is what their name is coloured by —
  // see lib/name-gradient.ts. Null for a player whose runs all predate `player_totals`:
  // the board still lists them, and their name is simply drawn uncoloured.
  avg_acc: number | null
  avg_spd: number | null
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

// One player's lifetime factor averages, as `players_factors` answers for them. Both
// null where the counters have never seen them.
export type PlayerFactorsRow = {
  user_id: string
  avg_acc: number | null
  avg_spd: number | null
}

// What a set of names should be coloured by, for the places no board row can say.
//
// A board row carries its player's averages already; this is for the three surfaces that
// draw a name without one — the player's own row below the board's cut, the intro
// greeting, and a multiplayer room. Keyed by id so a caller can look each name up.
//
// Every id asked about comes back, with nulls where nothing has been counted, so an
// absent entry means the request failed rather than that the player is new.
export async function fetchPlayerFactors(
  userIds: readonly string[],
): Promise<{ factors: Map<string, PlayerFactorsRow>; error: string | null }> {
  if (isEmptyArray(userIds)) return { factors: new Map(), error: null }
  const res = await supabase.rpc('players_factors', { p_users: userIds })
  noteRequest(res.error)
  if (res.error) return { factors: new Map(), error: res.error.message }
  const rows = (res.data as PlayerFactorsRow[] | null) ?? []
  return { factors: new Map(rows.map((row) => [row.user_id, row])), error: null }
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

// One round trip for the whole profile modal. Four requests for one screen are four
// answers that can disagree, and this one sits behind a tap that should feel instant.
//
// The period bounds go up with the call the way `my_medals` takes its own: the app draws
// them on the Prague clock, and a second definition in SQL is a second thing to keep in
// step. The champion mark is deliberately not in the response — `useChampions` already
// knows both Extreme leaders, and asking again here would let the modal contradict the
// row that opened it.
export async function fetchPlayerProfile(
  userId: string,
): Promise<{ profile: PlayerProfile | null; error: string | null }> {
  const today = todayISO()
  const res = await supabase.rpc('player_profile', {
    p_user_id: userId,
    p_today: today,
    p_week_since: weekStart(today),
  })
  noteRequest(res.error)
  if (res.error) return { profile: null, error: res.error.message }
  const raw = res.data as PlayerProfileResponse | null
  // A profile nobody could read is not an empty profile — the modal says so rather than
  // drawing a player with nothing on any board.
  if (raw === null) return { profile: null, error: 'empty response' }
  return { profile: shapeProfile(raw), error: null }
}

// What this player won in every window that closed since they were last told.
//
// Rows are validated on the way in the way every other board read here is: the database
// has no idea what a `ScoredMode` is, so a row whose mode or difficulty it does not
// recognise is dropped rather than trusted. The award itself is never asked for — the
// server returns what a window was won with, and `lib/winnings.ts` decides what that is
// worth, so the difficulty weighting has exactly one definition.
export async function fetchMyWinnings(
  userId: string,
  range: { from: string; to: string },
): Promise<{ awards: Award[]; error: string | null }> {
  const res = await supabase.rpc('my_winnings', {
    p_user_id: userId,
    p_from_day: range.from,
    // The RPC's upper bound is exclusive and means "today", so the inclusive last day the
    // caller wants is handed over as the day after it.
    p_today: nextDay(range.to),
  })
  noteRequest(res.error)
  if (res.error) return { awards: [], error: res.error.message }
  const rows = (res.data as WinningsRow[] | null) ?? []
  return { awards: rows.flatMap(toAward), error: null }
}

type WinningsRow = {
  period: string
  mode: string
  difficulty: string
  won_on: string
  best_score: number
}

const toAward = (row: WinningsRow): Award[] =>
  isOneOf(row.period, WIN_PERIODS) &&
  isOneOf(row.mode, SCORED_MODES) &&
  isDifficulty(row.difficulty)
    ? [
        {
          period: row.period,
          mode: row.mode,
          difficulty: row.difficulty,
          wonOn: row.won_on,
          score: row.best_score,
        },
      ]
    : []

// Writing the player's own motto. Null removes it.
//
// Straight at the row rather than through an RPC: `profiles` already lets a player
// update their own row and nobody else's — it is how the nickname beside it is written —
// and the column's check constraint is what a value of the wrong shape runs into.
//
// The caller has already put the text through `normalizeMotto`; this does not clean it
// again. One place decides what a motto looks like.
export async function saveMotto(
  userId: string,
  motto: string | null,
): Promise<{ error: string | null }> {
  const res = await supabase.from('profiles').update({ motto }).eq('id', userId)
  noteRequest(res.error)
  return { error: res.error?.message ?? null }
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
  avg_acc: number | null
  avg_spd: number | null
}

export type PastWinners = {
  yesterday: Winner | null
  lastWeek: Winner | null
}

export const NO_PAST_WINNERS: PastWinners = { yesterday: null, lastWeek: null }

const winnerIn = (rows: PastWinnerRow[], period: string): Winner | null => {
  const row = rows.find((r) => r.period === period)
  if (row === undefined) return null
  return {
    userId: row.user_id,
    nickname: row.nickname,
    avgAccuracy: row.avg_acc,
    avgSpeed: row.avg_spd,
  }
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
