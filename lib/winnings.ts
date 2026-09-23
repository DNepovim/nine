import { DIFFICULTIES, type Difficulty, type ScoredMode } from '@/machines/game'

// What taking a board pays.
//
// Winning a board's day or its week is the only thing in the app that pays for beating
// the other players rather than for playing: a board says who is ahead right now, and the
// moment the day rolls over that fact is gone. Winnings are what is left of it.
//
// See docs/superpowers/specs/2026-09-23-winnings-design.md.

// The two windows that can be won. A window still open pays nothing, because nobody has
// won it yet.
export const WIN_PERIODS = ['day', 'week'] as const
export type WinPeriod = (typeof WIN_PERIODS)[number]

// A day is worth half a week. The difficulty half of the weighting is not repeated here —
// it is `scoreWeight` in machines/modes.ts, the rule the profile modal already prints on
// screen as ESY ×0.5 · HRD ×1 · EXT ×2. A second table of factors differing only on Easy
// would make that legend a half-truth.
const PERIOD_SHARE = {
  day: 0.5,
  week: 1,
} as const satisfies Record<WinPeriod, number>

export const winFactor = (period: WinPeriod, difficulty: Difficulty): number =>
  DIFFICULTIES[difficulty].scoreWeight * PERIOD_SHARE[period]

// One payment, for one board, for one window.
export type Award = {
  period: WinPeriod
  mode: ScoredMode
  difficulty: Difficulty
  // The day won, or the Monday of the week won. ISO 'YYYY-MM-DD'.
  wonOn: string
  // What it was won with — the top score on that board in that window.
  score: number
}

// Unrounded. Everything that adds awards up rounds once at the end instead, because a
// half-weighted odd score lands on a half point and rounding the parts before adding them
// is how a total comes to be a point off the sum of its pieces.
export const awardValue = (award: Award): number =>
  award.score * winFactor(award.period, award.difficulty)

// One award as a figure to show beside the score it came from. The same arithmetic as
// `awardValue` read at a different moment, not a second tally.
export const awardPoints = (award: Award): number => Math.round(awardValue(award))

export const totalAwards = (awards: readonly Award[]): number =>
  Math.round(awards.reduce((sum, award) => sum + awardValue(award), 0))

// A player's winning scores on one board over all history, as `player_profile` answers
// for them: the sums, not the individual windows, because the total is all the profile
// shows and a row per day would be thousands of rows to say one number.
export type BoardWinnings = {
  mode: ScoredMode
  difficulty: Difficulty
  daySum: number
  weekSum: number
}

// Unrounded for the same reason `awardValue` is: `lifetimeOf` adds this to the scored
// rating and rounds the sum once.
export const winningsValue = (boards: readonly BoardWinnings[]): number =>
  boards.reduce(
    (sum, board) =>
      sum +
      board.daySum * winFactor('day', board.difficulty) +
      board.weekSum * winFactor('week', board.difficulty),
    0,
  )
