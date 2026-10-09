import { DIFFICULTIES, type Difficulty, type ScoredMode } from '@/modes'

// What taking a board pays.
//
// Winning a board's day or its week is the only thing in the app that pays for beating
// the other players rather than for playing: a board says who is ahead right now, and the
// moment the day rolls over that fact is gone. Winnings are what is left of it.
//
// See docs/superpowers/specs/2026-09-23-winnings-design.md, and
// docs/work/2026-10-09-claimed-winnings/spec.md for the podium and the accepting.

// The two windows that can be won. A window still open pays nothing, because nobody has
// won it yet.
export const WIN_PERIODS = ['day', 'week'] as const
export type WinPeriod = (typeof WIN_PERIODS)[number]

// The three steps a closed window pays. Not a medal, which is a standing on a board that
// is still open and can be taken back tomorrow — a podium is settled the moment its window
// shuts, and is paid once.
export const WIN_RANKS = [1, 2, 3] as const
export type WinRank = (typeof WIN_RANKS)[number]

// A day is worth half a week. The difficulty half of the weighting is not repeated here —
// it is `scoreWeight` in machines/modes.ts, the rule the profile modal already prints on
// screen as ESY ×0.5 · HRD ×1 · EXT ×2. A second table of factors differing only on Easy
// would make that legend a half-truth.
const PERIOD_SHARE = {
  day: 0.5,
  week: 1,
} as const satisfies Record<WinPeriod, number>

// What each step of the podium pays, as a share of its window's gold.
//
// Multiplies the two shares beside it rather than replacing either, so a second place on
// an Extreme week is still worth four of one on an Easy day. A tenth for third is the one
// factor here that is not a half of something: coming third is a mention rather than a
// result, and the figure should read as one.
const PODIUM_SHARE = {
  1: 1,
  2: 0.5,
  3: 0.1,
} as const satisfies Record<WinRank, number>

export const winFactor = (
  period: WinPeriod,
  difficulty: Difficulty,
  rank: WinRank,
): number =>
  DIFFICULTIES[difficulty].scoreWeight * PERIOD_SHARE[period] * PODIUM_SHARE[rank]

// One payment, for one board, for one window.
export type Award = {
  period: WinPeriod
  mode: ScoredMode
  difficulty: Difficulty
  // The day won, or the Monday of the week won. ISO 'YYYY-MM-DD'.
  wonOn: string
  // What it was placed with — **this player's** score in that window, not the winner's.
  // For rank one those are the same number.
  score: number
  // Which step of the podium. A window pays no further than third.
  rank: WinRank
}

// Unrounded. Everything that adds awards up rounds once at the end instead, because a
// half-weighted odd score lands on a half point and rounding the parts before adding them
// is how a total comes to be a point off the sum of its pieces. A third place's tenth puts
// hundredths into the same sums, which makes the rule stricter rather than looser.
export const awardValue = (award: Award): number =>
  award.score * winFactor(award.period, award.difficulty, award.rank)

// One award as a figure to show beside the score it came from. The same arithmetic as
// `awardValue` read at a different moment, not a second tally.
export const awardPoints = (award: Award): number => Math.round(awardValue(award))

export const totalAwards = (awards: readonly Award[]): number =>
  Math.round(awards.reduce((sum, award) => sum + awardValue(award), 0))

// A player's placing scores on one board, for one window kind, on one step of the podium,
// over the half of history they have already accepted — as `player_profile` answers for
// them. Sums rather than the individual windows, because the total is all the profile
// shows and a row per day would be thousands of rows to say one number.
//
// One row per step rather than a pair of sums per board: a second pair for silver would be
// four numbers on a row and a third would be six, and the weighting is per step anyway.
export type BoardWinnings = {
  mode: ScoredMode
  difficulty: Difficulty
  period: WinPeriod
  rank: WinRank
  scoreSum: number
}

// Unrounded for the same reason `awardValue` is: `lifetimeOf` adds this to the scored
// fortune and rounds the sum once.
export const winningsValue = (boards: readonly BoardWinnings[]): number =>
  boards.reduce(
    (sum, board) =>
      sum + board.scoreSum * winFactor(board.period, board.difficulty, board.rank),
    0,
  )
