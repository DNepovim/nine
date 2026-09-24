import { isNonEmptyString, isNumber, isObject, isOneOf } from 'narrowland'

import type { LeaderboardRow, LeaderboardTab } from '@/lib/leaderboard'
import { dayInPrague, weekStart } from '@/lib/leaderboard-period'
import {
  byBestClaim,
  MEDAL_PERIODS,
  medalRank,
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

// Where the player stood the last time the app looked, and the Prague day it looked on.
// The day is what makes the standings comparable at all — see SAME_WINDOW.
export type SeenStandings = {
  day: string
  standings: BoardStanding[]
}

// A medal the player held the last time they were here and does not hold now.
export type MedalLoss = {
  mode: ScoredMode
  difficulty: Difficulty
  period: MedalPeriod
  // The metal that was taken.
  had: 1 | 2 | 3
  // What is left of the standing: a lesser metal, or nothing at all.
  now: 1 | 2 | 3 | null
}

// Whether a standing seen on one day can be held against a standing seen on another.
//
// Only `ever` is unconditional. The day and week boards empty on the Prague clock, and a
// gold that is gone because the board under it was wiped at midnight was not taken by
// anybody — announcing that as a loss blames a rival for the calendar.
const SAME_WINDOW = {
  ever: () => true,
  week: (seen: string, today: string) => weekStart(seen) === weekStart(today),
  today: (seen: string, today: string) => seen === today,
} as const satisfies Record<MedalPeriod, (seen: string, today: string) => boolean>

const keyOf = (standing: BoardStanding): string =>
  `${standing.mode}:${standing.difficulty}:${standing.period}`

const isStanding = (value: unknown): value is BoardStanding =>
  isObject<Record<string, unknown>>(value) &&
  isOneOf(value.mode, SCORED_MODES) &&
  isOneOf(value.difficulty, DIFFICULTY_ORDER) &&
  isOneOf(value.period, MEDAL_PERIODS) &&
  isNumber(value.rank) &&
  isNumber(value.score)

// What came out of storage, narrowed back to the shape this file promises.
//
// The app wrote it, but a build that changes the shape reads what an older one left, and
// a half-understood row would be diffed as a loss the player never had. Rows that do not
// parse are dropped rather than defaulted: a standing nobody can read is a standing this
// cannot claim was taken.
export function toSeenStandings(value: unknown): SeenStandings | null {
  if (!isObject<Record<string, unknown>>(value)) return null
  const { day, standings } = value
  if (!isNonEmptyString(day) || !Array.isArray(standings)) return null
  return { day, standings: standings.filter(isStanding) }
}

// Every medal the player has lost since the snapshot was taken.
//
// `today` is passed in rather than read from the clock so callers — and tests — can pin
// it, the same way `tabSince` takes its own.
export function lostMedals(
  seen: SeenStandings,
  current: readonly BoardStanding[],
  today: string = dayInPrague(),
): MedalLoss[] {
  const standingNow = new Map(current.map((standing) => [keyOf(standing), standing]))
  return seen.standings.flatMap((standing) => {
    if (!SAME_WINDOW[standing.period](seen.day, today)) return []
    const had = medalRank(standing.rank, standing.score)
    if (had === null) return []
    const still = standingNow.get(keyOf(standing))
    const now = still === undefined ? null : medalRank(still.rank, still.score)
    // A metal that is the same or better is not a loss. Better happens: the player can
    // come back to a gold they left as a silver, because a rival above them dropped off
    // the board when its window rolled.
    if (now !== null && now <= had) return []
    return [
      {
        mode: standing.mode,
        difficulty: standing.difficulty,
        period: standing.period,
        had,
        now,
      },
    ]
  })
}

const medalOf = (loss: MedalLoss): Medal => ({
  mode: loss.mode,
  difficulty: loss.difficulty,
  period: loss.period,
  rank: loss.had,
})

// How many are said out loud. A bad night across four boards is a real night, but it is
// also most of a minute of a screen the player opened to press PLAY — and what falls off
// the end is the smallest claims, which is what the ordering below is for.
// These are also the ones the week's list keeps, since they are the ones a taker gets
// looked up for — a loss with nobody's name on it is half the record, and asking for more
// names means more requests on a launch that has already had a bad night.
const MAX_ANNOUNCED = 3

// The losses worth announcing, biggest claim first.
//
// Ordered by exactly the rule the medal line already sorts by, because it is that line's
// slot they are shown in: the all-time bronze leads, and the day silver that went with it
// follows. One board's worth of bad news reads as one story told in order, rather than as
// whichever row the server happened to return first.
export function announcedLosses(losses: readonly MedalLoss[]): MedalLoss[] {
  return [...losses]
    .sort((a, b) => byBestClaim(medalOf(a), medalOf(b)))
    .slice(0, MAX_ANNOUNCED)
}

// Which leaderboard a medal stood on. The medal periods and the board tabs are the same
// three windows under two names — `ever` is the board's `forever` — so this is what keeps
// every lookup from having to remember that they disagree.
export const PERIOD_TABS = {
  today: 'today',
  week: 'week',
  ever: 'forever',
} as const satisfies Record<MedalPeriod, LeaderboardTab>

// Whoever the medal went to.
export type Taker = { userId: string; nickname: string }

// Who stands where the player used to, or null when the board cannot name anybody.
//
// The rank is the question, not the score: the player who now holds the place that was
// the player's is the one who took it, whether they edged past by a point or buried it.
// Matched on the row's own `rank` rather than on its position in the list, so a board
// that answers short or starts below first place cannot hand back the wrong player.
//
// A row that is the player's own means the place was not lost to anyone — their own
// better score is standing there — and a nameless row is nobody to announce. Both come
// back null, which the line reads as "taken", without a name.
export function takerOf(
  rows: readonly LeaderboardRow[],
  loss: MedalLoss,
  userId: string | null,
): Taker | null {
  const row = rows.find((candidate) => candidate.rank === loss.had)
  if (row === undefined || row.user_id === userId) return null
  if (!isNonEmptyString(row.nickname)) return null
  return { userId: row.user_id, nickname: row.nickname }
}
