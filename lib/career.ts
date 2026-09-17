import {
  DIFFICULTY_ORDER,
  SCORED_MODES,
  type Difficulty,
  type Mode,
} from '@/machines/game'

// Everything the player has done, ever — as opposed to `Stats` (machines/game.ts), which
// is their best on each board.
//
// A separate store on purpose. `STATS_KEY` is versioned on the *scoring mechanics* and is
// dropped whenever they change, because a best set under the old rules is not comparable
// to one set under the new ones. A thousand lifetime hits is a thousand lifetime hits
// whatever the points were worth at the time, so none of this may ride on that key.
//
// Nothing here is shown as a number on its own. It exists to answer the achievements, and
// every field is here because some achievement asks for it.
export type Career = {
  runs: number
  hits: number
  points: number
  // Hits that landed on a streak, over every run.
  strikes: number
  // The longest streak ever reached, in any run.
  bestStreak: number
  // The most hits reached in one run *before the first life was lost*. Not "a run
  // finished without losing a life" — see cleanHits on RunSummary for why that cannot
  // happen.
  bestCleanHits: number
  // How many times a run has beaten the player's own stored best.
  personalBests: number
  longestRunMs: number
  // The boards a score has been posted on, as `boardKey` strings. Trainee keeps no
  // board, so it is never in here.
  boardsPlayed: string[]
  // The last day a run was played, ISO 'YYYY-MM-DD' on the shared Prague clock — the
  // same day a score is stamped with, so the two can never disagree.
  lastDay: string | null
  dayStreak: number
  bestDayStreak: number
  multiplayerRuns: number
  multiplayerWins: number
  // When the player was first seen holding a board's all-time record, keyed by
  // `boardKey`. The app keeps no history of the boards, so "held it for a week" is not
  // answerable from anything else that exists; this is the smallest thing that makes it
  // answerable. Set the first time the board reports them first, dropped the moment it
  // does not — losing the board and retaking it starts the clock over, which is the
  // honest reading of "held".
  heldSince: Record<string, string>
}

// One finished run, as far as the career is concerned.
export type RunSummary = {
  mode: Mode
  difficulty: Difficulty
  score: number
  hits: number
  strikes: number
  // The longest streak this run reached, not the one it ended on.
  maxStreak: number
  // How many hits had landed when the first life was lost — the whole run's hits if none
  // ever was.
  //
  // This is a property of a run *in progress*, never of a finished one: a run ends
  // because its lives ran out, so there is no such thing as finishing with them intact.
  // Trainee never ends at all, and has no lives to lose, so its clean stretch is simply
  // its hits.
  cleanHits: number
  elapsedMs: number
  day: string
  // Whether this run beat the player's own stored best on its board.
  personalBest: boolean
}

// One board, as a storage key. Mode first, so every board of a mode sorts together.
export const boardKey = (mode: Mode, difficulty: Difficulty): string =>
  `${mode}:${difficulty}`

// Every board that keeps a leaderboard — the six `ALL SIX BOARDS` counts.
export const ALL_BOARDS: readonly string[] = SCORED_MODES.flatMap((mode) =>
  DIFFICULTY_ORDER.map((difficulty) => boardKey(mode, difficulty)),
)

export const emptyCareer = (): Career => ({
  runs: 0,
  hits: 0,
  points: 0,
  strikes: 0,
  bestStreak: 0,
  bestCleanHits: 0,
  personalBests: 0,
  longestRunMs: 0,
  boardsPlayed: [],
  lastDay: null,
  dayStreak: 0,
  bestDayStreak: 0,
  multiplayerRuns: 0,
  multiplayerWins: 0,
  heldSince: {},
})

const DAY_MS = 86_400_000

// The ISO day after `day`. Days are 'YYYY-MM-DD' throughout, so this is the only place
// that has to turn one back into a date.
const nextDay = (day: string): string =>
  new Date(new Date(`${day}T00:00:00Z`).getTime() + DAY_MS).toISOString().slice(0, 10)

// How many consecutive days of play this run makes it, given the last one seen.
//
// Same day: the streak is already counted and must not climb twice. The very next day:
// one longer. Anything else — a gap, or a run stamped with a day already behind us —
// starts again at one. A run cannot *reduce* a streak, so an out-of-order day is treated
// as a fresh start rather than allowed to rewind `lastDay`.
const streakAfter = (lastDay: string | null, day: string): number => {
  if (lastDay === null) return 1
  if (day === lastDay) return 0 // unchanged — the caller keeps what it had
  if (day === nextDay(lastDay)) return -1 // one more — the caller adds
  return 1
}

// Folds a finished run into the career.
//
// Everything here is monotonic except the day streak, which is the one thing that can
// fall — and it falls by starting over, never by going backwards.
export function foldRun(career: Career, run: RunSummary): Career {
  const step = streakAfter(career.lastDay, run.day)
  const dayStreak = step === 0 ? career.dayStreak : step === -1 ? career.dayStreak + 1 : 1

  // Trainee has no board to be played on, and a run that scored nothing has not put
  // anything on the one it was played on.
  const board =
    run.score > 0 && run.mode !== 'trainee' ? boardKey(run.mode, run.difficulty) : null

  return {
    ...career,
    runs: career.runs + 1,
    hits: career.hits + run.hits,
    points: career.points + run.score,
    strikes: career.strikes + run.strikes,
    bestStreak: Math.max(career.bestStreak, run.maxStreak),
    bestCleanHits: Math.max(career.bestCleanHits, run.cleanHits),
    personalBests: career.personalBests + (run.personalBest ? 1 : 0),
    longestRunMs: Math.max(career.longestRunMs, run.elapsedMs),
    boardsPlayed:
      board !== null && !career.boardsPlayed.includes(board)
        ? [...career.boardsPlayed, board]
        : career.boardsPlayed,
    // Only ever forward. A run stamped with an older day — a clock that moved, a queued
    // run flushed late — must not drag the last day back with it.
    lastDay:
      career.lastDay === null || run.day > career.lastDay ? run.day : career.lastDay,
    dayStreak,
    bestDayStreak: Math.max(career.bestDayStreak, dayStreak),
  }
}

// Folds a finished multiplayer run in. Its own entry point rather than a flag on
// `RunSummary`: a shared run has no board of its own, sets no personal best and keeps no
// stats, so all it contributes is that it happened and how it went.
export const foldMultiplayer = (career: Career, won: boolean): Career => ({
  ...career,
  multiplayerRuns: career.multiplayerRuns + 1,
  multiplayerWins: career.multiplayerWins + (won ? 1 : 0),
})

// Records which boards the player is holding right now.
//
// Boards already being held keep the moment they were first seen — that moment is the
// whole point — and boards no longer held are dropped outright rather than kept with a
// stale timestamp, so retaking one starts its clock from scratch.
export function observeHeld(
  career: Career,
  held: readonly string[],
  now: string,
): Career {
  const heldSince = Object.fromEntries(
    held.map((key) => [key, career.heldSince[key] ?? now]),
  )
  return { ...career, heldSince }
}

// How long a board has been held, in whole days, or 0 for one not held at all.
export function heldDays(career: Career, board: string, now: Date): number {
  const since = career.heldSince[board]
  if (since === undefined) return 0
  const elapsed = now.getTime() - new Date(since).getTime()
  return elapsed <= 0 ? 0 : Math.floor(elapsed / DAY_MS)
}
