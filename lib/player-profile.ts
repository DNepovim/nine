import { isOneOf } from 'narrowland'

import { isDifficulty } from '@/lib/is-difficulty'
import {
  MEDAL_PERIODS,
  toMedals,
  type BoardStanding,
  type Medal,
  type MedalPeriod,
} from '@/lib/medals'
import {
  DIFFICULTY_ORDER,
  SCORED_MODES,
  type Difficulty,
  type ScoredMode,
} from '@/machines/game'

// What a tapped name opens: one player, as the `player_profile` RPC answers for them.
//
// Every number here is either already on a board or an aggregate of runs that were, so
// it is public for any player — including the one holding the phone, who gets the same
// modal with the same numbers rather than a version of their own.

// Lifetime counters for one board. `accSum` and `spdSum` are sums over every hit of that
// hit's factor; an average is the sum over the hits, never stored as an average.
export type BoardTotals = {
  mode: ScoredMode
  difficulty: Difficulty
  runs: number
  hits: number
  scoreSum: number
  accSum: number
  spdSum: number
}

type BoardBest = {
  mode: ScoredMode
  difficulty: Difficulty
  score: number
  hits: number
  achievedAt: string
}

// One unbroken stretch of holding an all-time board. `lostAt` is null while it is still
// theirs — the distinction the whole list is about.
export type Reign = {
  mode: ScoredMode
  difficulty: Difficulty
  score: number
  tookAt: string
  lostAt: string | null
}

export type PlayerProfile = {
  // Null for a player who has no nickname, which is also a player no board can show —
  // so in practice this is never the name behind a tap, only a guard the type keeps.
  nickname: string | null
  totals: BoardTotals[]
  bests: BoardBest[]
  // The same one-per-mode reduction the intro screen's line under the title uses, from
  // the same function — a player's best claim in each mode, not all eighteen standings.
  medals: Medal[]
  reigns: Reign[]
}

// One row of the modal's per-board block: what this player has done on one board.
// `best`, `average` and `runs` are independent — a board can hold a best from before the
// counters existed and no runs at all.
export type BoardRow = {
  mode: ScoredMode
  difficulty: Difficulty
  runs: number
  best: number | null
  // Accuracy for an Accuracy board, speed for a Speed board, as a percentage. Null when
  // no hit has been counted there, which is not the same as zero.
  average: number | null
}

// The factor sums travel with the totals so the modal can show one lifetime average per
// factor, the way the game over screen shows one per run. Every hit carries both, in
// either mode, so both are summed over every board rather than over its own mode.
export type Lifetime = {
  runs: number
  hits: number
  score: number
  accSum: number
  spdSum: number
}

// Which sum each mode is judged on. Both are written for both modes — they cost nothing
// — but a mode is only asked the question it exists to answer: Accuracy how exact, Speed
// how fast.
const AVERAGE_SUM = {
  accuracy: (totals: BoardTotals) => totals.accSum,
  speed: (totals: BoardTotals) => totals.spdSum,
} as const satisfies Record<ScoredMode, (totals: BoardTotals) => number>

// A factor sum over its hits, as a percentage. The same formula the game over screen
// uses for a single run (`round(100 * accSum / hits)`), because a profile and a run
// stat that computed one number two ways would eventually disagree about it.
//
// Not clamped to 100: `speedReward` pays a bonus above the fast band, so a very quick
// player really does average over 100, and the run stats already say so.
export const averagePercent = (sum: number, hits: number): number | null =>
  hits > 0 ? Math.round((100 * sum) / hits) : null

// Everything the player has done on every board, added up. Derived rather than stored —
// a seventh row holding the same fact is a seventh chance to disagree with it.
export const lifetimeOf = (totals: readonly BoardTotals[]): Lifetime =>
  totals.reduce<Lifetime>(
    (sum, board) => ({
      runs: sum.runs + board.runs,
      hits: sum.hits + board.hits,
      score: sum.score + board.scoreSum,
      accSum: sum.accSum + board.accSum,
      spdSum: sum.spdSum + board.spdSum,
    }),
    { runs: 0, hits: 0, score: 0, accSum: 0, spdSum: 0 },
  )

// The six boards in the app's own order — mode, then difficulty — whether or not the
// player has ever touched them. A board never played is a row of dashes, which says
// something a missing row does not.
export function boardRows(profile: PlayerProfile): BoardRow[] {
  return SCORED_MODES.flatMap((mode) =>
    DIFFICULTY_ORDER.map((difficulty) => {
      const totals = profile.totals.find(
        (row) => row.mode === mode && row.difficulty === difficulty,
      )
      const best = profile.bests.find(
        (row) => row.mode === mode && row.difficulty === difficulty,
      )
      return {
        mode,
        difficulty,
        runs: totals?.runs ?? 0,
        best: best?.score ?? null,
        average:
          totals === undefined
            ? null
            : averagePercent(AVERAGE_SUM[mode](totals), totals.hits),
      }
    }),
  )
}

// Newest first. A player's most recent reign is the one they are most likely to still
// be holding, and an open reign is the headline of the list.
export const sortReigns = (reigns: readonly Reign[]): Reign[] =>
  [...reigns].sort((a, b) => Date.parse(b.tookAt) - Date.parse(a.tookAt))

// ─── Reading it ──────────────────────────────────────────────────────────────

// The RPC's json, before anything has been narrowed. `mode`, `difficulty` and `period`
// arrive as plain strings — the database has no idea what a `ScoredMode` is — so every
// row is checked on the way in and a row that fails is dropped rather than trusted.
type RawBoard = { mode: string; difficulty: string }

export type PlayerProfileResponse = {
  nickname: string | null
  totals: (RawBoard & {
    runs: number
    hits: number
    scoreSum: number
    accSum: number
    spdSum: number
  })[]
  bests: (RawBoard & { bestScore: number; hits: number; achievedAt: string })[]
  medals: (RawBoard & { period: string; rank: number; bestScore: number })[]
  reigns: (RawBoard & { score: number; tookAt: string; lostAt: string | null })[]
}

const board = (raw: RawBoard): { mode: ScoredMode; difficulty: Difficulty } | null =>
  isOneOf(raw.mode, SCORED_MODES) && isDifficulty(raw.difficulty)
    ? { mode: raw.mode, difficulty: raw.difficulty }
    : null

const isMedalPeriod = (value: string): value is MedalPeriod =>
  MEDAL_PERIODS.some((period) => period === value)

export function shapeProfile(raw: PlayerProfileResponse): PlayerProfile {
  return {
    nickname: raw.nickname,
    totals: raw.totals.flatMap((row) => {
      const on = board(row)
      return on === null ? [] : [{ ...on, ...pickTotals(row) }]
    }),
    bests: raw.bests.flatMap((row) => {
      const on = board(row)
      return on === null
        ? []
        : [{ ...on, score: row.bestScore, hits: row.hits, achievedAt: row.achievedAt }]
    }),
    // Straight through `toMedals`, which drops anything off the podium, drops a rank one
    // with no score behind it, and keeps each mode's best claim. Reusing it is what makes
    // a profile's line and the intro's line the same line.
    medals: toMedals(
      raw.medals.flatMap<BoardStanding>((row) => {
        const on = board(row)
        return on === null || !isMedalPeriod(row.period)
          ? []
          : [{ ...on, period: row.period, rank: row.rank, score: row.bestScore }]
      }),
    ),
    reigns: sortReigns(
      raw.reigns.flatMap((row) => {
        const on = board(row)
        return on === null
          ? []
          : [{ ...on, score: row.score, tookAt: row.tookAt, lostAt: row.lostAt }]
      }),
    ),
  }
}

const pickTotals = (
  row: PlayerProfileResponse['totals'][number],
): Omit<BoardTotals, 'mode' | 'difficulty'> => ({
  runs: row.runs,
  hits: row.hits,
  scoreSum: row.scoreSum,
  accSum: row.accSum,
  spdSum: row.spdSum,
})

export const EMPTY_PROFILE: PlayerProfile = {
  nickname: null,
  totals: [],
  bests: [],
  medals: [],
  reigns: [],
}
