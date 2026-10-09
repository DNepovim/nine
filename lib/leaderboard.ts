import { isEmptyArray, isOneOf } from 'narrowland'

import type { Leader } from '@/lib/announcements'
import { noteRequest } from '@/lib/connectivity'
import { isDifficulty } from '@/lib/is-difficulty'
import {
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
import type { RecapRow } from '@/lib/recap'
import type { Winner } from '@/lib/recent-winners'
import { supabase } from '@/lib/supabase'
import { WIN_PERIODS, WIN_RANKS, type Award } from '@/lib/winnings'
import { SCORED_MODES, type Difficulty, type ModeId } from '@/modes'

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
  mode: ModeId,
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

// Every podium place this player is owed for: the windows that closed after the day their
// winnings are paid through, up to but not including today, whose own day has not closed.
//
// No span is passed and no user id either. Where the boundary falls is the watermark on
// the player's own profile, which the server holds and this device does not — a launch
// that worked it out from a local marker was a launch that could forfeit a reward by
// having its storage wiped. `auth.uid()` identifies the asker, because what a player is
// owed is the one thing on this path that is nobody else's business.
//
// Rows are validated on the way in the way every other board read here is: the database
// has no idea what a `ScoredMode` is, so a row whose mode, difficulty or step it does not
// recognise is dropped rather than trusted. The award itself is never asked for — the
// server returns what a window was placed with, and `lib/winnings.ts` decides what that is
// worth, so the weighting has exactly one definition.
export async function fetchUnpaidWinnings(
  today: string,
): Promise<{ awards: Award[]; error: string | null }> {
  const res = await supabase.rpc('my_unpaid_winnings', { p_today: today })
  noteRequest(res.error)
  if (res.error) return { awards: [], error: res.error.message }
  const rows = (res.data as WinningsRow[] | null) ?? []
  return { awards: rows.flatMap(toAward), error: null }
}

// Turning what is owed into fortune. The one write on this path.
//
// Moves the player's watermark to yesterday, which is what puts every window behind it
// into the figure `player_profile` adds up. Idempotent at the database — the watermark only
// ever moves forward — so a retry, or a second press, lands on the same number.
//
// The error is returned rather than thrown because of what the caller does with it: the
// page advances either way, since the button is the only way off it and trapping a player
// there would be worse than making them press again tomorrow. An accept that failed simply
// leaves the reward where it was.
export async function acceptWinnings(today: string): Promise<{ error: string | null }> {
  const res = await supabase.rpc('accept_winnings', { p_today: today })
  noteRequest(res.error)
  return { error: res.error === null ? null : res.error.message }
}

type WinningsRow = {
  period: string
  mode: string
  difficulty: string
  won_on: string
  best_score: number
  rank: number
}

const toAward = (row: WinningsRow): Award[] =>
  isOneOf(row.period, WIN_PERIODS) &&
  isOneOf(row.mode, SCORED_MODES) &&
  isDifficulty(row.difficulty) &&
  isOneOf(row.rank, WIN_RANKS)
    ? [
        {
          period: row.period,
          mode: row.mode,
          difficulty: row.difficulty,
          wonOn: row.won_on,
          score: row.best_score,
          rank: row.rank,
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
//
// The row is read back on purpose. A bare update answers 204 No Content whether it wrote
// one row or none — a write filtered out by the row policy, or aimed at an id that is not
// the signed-in player's, is indistinguishable from a write that landed. That is how a
// motto came to appear under the nickname, on a screen told the save had succeeded, while
// nothing had been stored. Asking for the row makes the server say which it was: it comes
// back 200 with the motto on success, and `single` turns no row at all into an error the
// player is shown rather than a success they are told about.
export async function saveMotto(
  userId: string,
  motto: string | null,
): Promise<{ error: string | null }> {
  const res = await supabase
    .from('profiles')
    .update({ motto })
    .eq('id', userId)
    .select('motto')
    .single()
  noteRequest(res.error)
  return { error: res.error?.message ?? null }
}

export async function fetchMyRank(
  userId: string,
  mode: ModeId,
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
  mode: ModeId,
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

// Last week on the boards, as facts: who topped each of the six on each of its seven days,
// and which all-time boards changed hands while it ran.
//
// Bounds are passed in rather than computed here, unlike `fetchPastWinners` above: the hook
// holds the window already — it is what it compares against its marker to decide whether
// there is anything to tell at all — and deriving it twice is how the two would come to
// disagree about which week was being reported.
//
// Rows come back raw. `factsFromRows` is what checks them and lays them out, which keeps
// this function to the request and puts the one definition of a week's shape beside the
// code that reads it.
export async function fetchWeeklyRecap(range: {
  from: string
  to: string
}): Promise<{ rows: RecapRow[]; error: string | null }> {
  const res = await supabase.rpc('weekly_recap', {
    p_from: range.from,
    p_to: range.to,
  })
  noteRequest(res.error)
  if (res.error) return { rows: [], error: res.error.message }
  return { rows: (res.data as RecapRow[] | null) ?? [], error: null }
}
