import { isNonEmptyString, isNumber, isObject, isOneOf } from 'narrowland'

import { minusDays } from '@/lib/leaderboard-period'
import type { MedalLoss, Taker } from '@/lib/lost-medals'
import { byBestClaim, MEDAL_PERIODS, type Medal, type MedalPeriod } from '@/lib/medals'
import {
  DIFFICULTY_ORDER,
  SCORED_MODES,
  type Difficulty,
  type ScoredMode,
} from '@/machines/game'

// How far back the list of what was taken reaches, today included. A week, because that
// is the window a player can still do something about: the week board is still open, and
// a rival who took a place on it can be answered before it empties on Monday.
export const HISTORY_DAYS = 7

const PODIUM = [1, 2, 3] as const

// A medal the player held and does not any more, kept so it can be read back later.
//
// The line under the title says each of these once, on the launch that noticed it, and
// then it is gone — which is right for a line that has to hand the screen back, and wrong
// as the only record of it. This is the record: the same loss, written down.
export type TakenMedal = {
  mode: ScoredMode
  difficulty: Difficulty
  period: MedalPeriod
  // The metal that was taken, not whatever is left.
  had: 1 | 2 | 3
  // Who holds it now, or null when the board could not name anybody. Frozen at the moment
  // it was noticed rather than looked up again on reading: the question this answers is
  // who took it, and by next week somebody else may hold the place.
  taker: Taker | null
  // The Prague day the app noticed, which is not always the day it happened — a loss that
  // landed while the app was closed is dated to the launch that found it. It is the only
  // day this can honestly claim, and it is what the week window is measured against.
  day: string
}

const isTaker = (value: unknown): value is Taker =>
  isObject<Record<string, unknown>>(value) &&
  isNonEmptyString(value.userId) &&
  isNonEmptyString(value.nickname)

const isTaken = (value: unknown): value is TakenMedal =>
  isObject<Record<string, unknown>>(value) &&
  isOneOf(value.mode, SCORED_MODES) &&
  isOneOf(value.difficulty, DIFFICULTY_ORDER) &&
  isOneOf(value.period, MEDAL_PERIODS) &&
  isNumber(value.had) &&
  isOneOf(value.had, PODIUM) &&
  isNonEmptyString(value.day) &&
  (value.taker === null || isTaker(value.taker))

// What came out of storage, narrowed back to the shape this file promises. Rows that do
// not parse are dropped rather than defaulted, for the same reason `toSeenStandings`
// drops them: a loss nobody can read is a loss this cannot claim happened.
export function toMedalHistory(value: unknown): TakenMedal[] {
  if (!Array.isArray(value)) return []
  return value.filter(isTaken)
}

// One loss, once. The same medal taken on the same day is one line however many times a
// launch manages to notice it — a snapshot that could not be written is the case that
// would otherwise report the whole night again tomorrow.
const keyOf = (taken: TakenMedal): string =>
  `${taken.mode}:${taken.difficulty}:${taken.period}:${taken.had}:${taken.day}`

const medalOf = (taken: TakenMedal): Medal => ({
  mode: taken.mode,
  difficulty: taken.difficulty,
  period: taken.period,
  rank: taken.had,
})

// Newest first, and within a day the biggest claim first — the same rule the medal line
// orders by, so one bad night reads as one story in the order it is worth hearing.
const byRecency = (a: TakenMedal, b: TakenMedal): number =>
  b.day.localeCompare(a.day) || byBestClaim(medalOf(a), medalOf(b))

// What the week's list holds after this launch's losses are added to it.
//
// Pure, and given `today` rather than reading the clock, so the pruning can be pinned by a
// test the way every other window in the app is.
export function recordTaken(
  history: readonly TakenMedal[],
  losses: readonly { loss: MedalLoss; taker: Taker | null }[],
  today: string,
): TakenMedal[] {
  const cutoff = minusDays(today, HISTORY_DAYS - 1)
  const added = losses.map(({ loss, taker }) => ({
    mode: loss.mode,
    difficulty: loss.difficulty,
    period: loss.period,
    had: loss.had,
    taker,
    day: today,
  }))
  const byKey = new Map<string, TakenMedal>()
  // The stored rows go in first, so a loss already written down keeps the name it was
  // written down with — a second look at the same board can come back with a different
  // player standing there, and the one who took it is the one who was there at the time.
  for (const taken of [...history, ...added]) {
    if (taken.day < cutoff) continue
    if (!byKey.has(keyOf(taken))) byKey.set(keyOf(taken), taken)
  }
  return [...byKey.values()].sort(byRecency)
}

// The stored list, pruned to the window and ordered for reading — what a launch that lost
// nothing still has to do before showing it, since a week rolls on without any help.
export const prunedHistory = (
  history: readonly TakenMedal[],
  today: string,
): TakenMedal[] => recordTaken(history, [], today)
