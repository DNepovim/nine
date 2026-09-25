import { ACHIEVEMENT_COUNT } from '@/constants/achievements'
import {
  averagePercent,
  boardRows,
  lifetimeOf,
  type PlayerProfile,
} from '@/lib/player-profile'
import {
  DIFFICULTY_ORDER,
  SCORED_MODES,
  type Difficulty,
  type ScoredMode,
} from '@/machines/game'

// Two careers side by side: the player holding the phone against the one whose name they
// tapped. Every figure here is already on the profile modal — this puts the same numbers
// in two columns and says which side is ahead.
//
// Pure, and deliberately: who leads a row is the one judgement this feature makes, and it
// is worth being able to test it without mounting a card.

// The lifetime rows, in the order they are drawn. The same seven figures the profile
// prints above its per-board table, so the two screens can never disagree about what a
// career consists of.
export const COMPARE_STATS = [
  'rating',
  'runs',
  'hits',
  'time',
  'accuracy',
  'speed',
  'achievements',
] as const

export type CompareStat = (typeof COMPARE_STATS)[number]

// The rows that pick a winner. The three left out — RUNS, HITS, TIME — count how much a
// player has played rather than how well: a career twice as long is not a career twice as
// good, and highlighting it as one would make the table say something it does not mean.
// They are still shown, because how much of it there is is the context the judged rows are
// read in.
export const JUDGED_STATS: readonly CompareStat[] = [
  'rating',
  'accuracy',
  'speed',
  'achievements',
]

// Which column a row goes to, or null for a row nobody wins: an unjudged one, a tie, and a
// board neither player has touched.
export type CompareSide = 'mine' | 'theirs' | null

// Null is *absent*, never zero — a board never played, an average over no hits. The two
// read differently in the table and they lead differently: an absent value can never take
// a row, and a present zero can.
type CompareRow = {
  stat: CompareStat
  mine: number | null
  theirs: number | null
  leader: CompareSide
}

type CompareBoardRow = {
  difficulty: Difficulty
  // The best score each side has posted on this board, or null for a side that has never
  // posted one.
  mine: number | null
  theirs: number | null
  leader: CompareSide
}

// One mode's three boards, so the table can head them the way the profile does rather than
// spelling the mode into all six row labels.
type CompareBoards = {
  mode: ScoredMode
  rows: CompareBoardRow[]
}

export type Comparison = {
  lifetime: CompareRow[]
  boards: CompareBoards[]
}

// Higher takes it. A side with nothing there cannot win a row it was never on, which is
// what makes a lone number beat an absent one and two absences beat neither.
const leaderOf = (mine: number | null, theirs: number | null): CompareSide => {
  if (mine === null && theirs === null) return null
  if (theirs === null) return 'mine'
  if (mine === null) return 'theirs'
  if (mine === theirs) return null
  return mine > theirs ? 'mine' : 'theirs'
}

// What each stat is, read off one profile. Everything is derived from the same helpers the
// profile modal draws with — `lifetimeOf` and `averagePercent` — so a figure cannot come to
// mean one thing on a profile and another beside it.
//
// A career with nothing in it answers 0 for the counters and null for the averages: no
// runs really is no runs, but an average over no hits is a question the player has not
// answered yet.
const STAT_VALUE = {
  rating: (career) => career.lifetime.rating,
  runs: (career) => career.lifetime.runs,
  hits: (career) => career.lifetime.hits,
  time: (career) => career.lifetime.timeMs,
  accuracy: (career) => averagePercent(career.lifetime.accSum, career.lifetime.hits),
  speed: (career) => averagePercent(career.lifetime.spdSum, career.lifetime.hits),
  // Held to this build's catalogue, the way the profile holds it: a device running ahead
  // can have earned an achievement this one has never heard of, and a row that let one
  // player win on achievements this build cannot name is a bug wearing a number. The
  // table prints the bare count rather than the fraction, so nothing on screen says what
  // it is being held to — the clamp is about who takes the row, not about the arithmetic
  // adding up in front of the player.
  achievements: (career) => Math.min(career.profile.achievements, ACHIEVEMENT_COUNT),
} as const satisfies Record<CompareStat, (career: Career) => number | null>

type Career = {
  profile: PlayerProfile
  lifetime: ReturnType<typeof lifetimeOf>
  boards: ReturnType<typeof boardRows>
}

const careerOf = (profile: PlayerProfile): Career => ({
  profile,
  lifetime: lifetimeOf(profile.totals, profile.winnings),
  boards: boardRows(profile),
})

// A best on one board, or null where that side has never posted one. `boardRows` already
// answers for all six boards whether or not they were played, so a missing block here would
// be a bug rather than an unplayed board.
const bestOn = (
  career: Career,
  mode: ScoredMode,
  difficulty: Difficulty,
): number | null =>
  career.boards.find((row) => row.mode === mode && row.difficulty === difficulty)?.best ??
  null

export function compareProfiles(mine: PlayerProfile, theirs: PlayerProfile): Comparison {
  const us = careerOf(mine)
  const them = careerOf(theirs)

  return {
    lifetime: COMPARE_STATS.map((stat) => {
      const ours = STAT_VALUE[stat](us)
      const yours = STAT_VALUE[stat](them)
      return {
        stat,
        mine: ours,
        theirs: yours,
        leader: JUDGED_STATS.includes(stat) ? leaderOf(ours, yours) : null,
      }
    }),
    boards: SCORED_MODES.map((mode) => ({
      mode,
      rows: DIFFICULTY_ORDER.map((difficulty) => {
        const ours = bestOn(us, mode, difficulty)
        const yours = bestOn(them, mode, difficulty)
        return { difficulty, mine: ours, theirs: yours, leader: leaderOf(ours, yours) }
      }),
    })),
  }
}

// Which of the two halves of a row a cell is, from the row's verdict. Here rather than in
// the table so the two row components cannot come to disagree about what a leader looks
// like — and so the one line of logic behind every highlight on the screen is tested.
export const toneFor = (
  leader: CompareSide,
  side: 'mine' | 'theirs',
): 'lead' | 'trail' | 'plain' => {
  if (leader === null) return 'plain'
  return leader === side ? 'lead' : 'trail'
}
