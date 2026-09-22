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
  // The three figures the mastery achievements count, kept per difficulty because those
  // achievements are staged by board: the longest streak ever reached, the most hits
  // reached *before the first life was lost* (not "a run finished without losing a life"
  // — see cleanHits on RunSummary for why that cannot happen), and the most hits taken in
  // exactly the optimal number of presses. Trainee raises none of them: it has no
  // difficulty selector, so the difficulty it happens to carry says nothing about which
  // board the feat belongs to.
  bestStreakBy: Record<Difficulty, number>
  bestCleanHitsBy: Record<Difficulty, number>
  bestParHitsBy: Record<Difficulty, number>
  // How many times a run has beaten the player's own stored best.
  personalBests: number
  longestRunMs: number
  // The boards a score has been posted on, as `boardKey` strings. Trainee keeps no
  // board, so it is never in here.
  boardsPlayed: string[]
  // Every mode ever played, scoring or not — "played all three" is about having tried
  // them, not about having been good at them, so this counts a run that scored nothing.
  modesPlayed: string[]
  // Every difficulty ever played, on a scored mode only. Trainee has no difficulty
  // selector and always runs at the Easy pace, so whatever `context.difficulty` happens
  // to be set to while practising says nothing about what the player has attempted.
  difficultiesPlayed: string[]
  // The last day a run was played, ISO 'YYYY-MM-DD' on the shared Prague clock — the
  // same day a score is stamped with, so the two can never disagree.
  lastDay: string | null
  dayStreak: number
  bestDayStreak: number
  // Finished runs in a row that scored under `POOR_RUN_SCORE`, reset by the first one
  // that does better. The only counter here that can fall, and it falls the same way the
  // day streak does: back to nothing, rather than backwards.
  poorRunStreak: number
  multiplayerRuns: number
  multiplayerWins: number
  // The most players ever in a room with them, themselves included.
  biggestRoom: number
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
  // Hits taken in exactly the optimal number of presses.
  parHits: number
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

// No board has been played yet, on any difficulty. A fresh object each time — these are
// folded into by copy, and a shared one would be a default every career pointed at.
const noBests = (): Record<Difficulty, number> => ({ easy: 0, hard: 0, extreme: 0 })

export const emptyCareer = (): Career => ({
  runs: 0,
  hits: 0,
  points: 0,
  strikes: 0,
  bestStreakBy: noBests(),
  bestCleanHitsBy: noBests(),
  bestParHitsBy: noBests(),
  personalBests: 0,
  longestRunMs: 0,
  boardsPlayed: [],
  modesPlayed: [],
  difficultiesPlayed: [],
  lastDay: null,
  dayStreak: 0,
  bestDayStreak: 0,
  poorRunStreak: 0,
  multiplayerRuns: 0,
  multiplayerWins: 0,
  biggestRoom: 0,
  heldSince: {},
})

const DAY_MS = 86_400_000

// What counts as a run that went nowhere. Deliberately low and mode-blind: points are
// not comparable between Accuracy and Speed, and this is not trying to measure a bad run
// — only one that barely got started. Lives here rather than with the achievement that
// reads it, because the fold is what decides, and two numbers would eventually differ.
export const POOR_RUN_SCORE = 100

// The ISO day after `day`. Days are 'YYYY-MM-DD' throughout, so this is the only place
// that has to turn one back into a date.
const nextDay = (day: string): string =>
  new Date(new Date(`${day}T00:00:00Z`).getTime() + DAY_MS).toISOString().slice(0, 10)

// How many consecutive days of play a run on `day` makes it.
//
// Same day: the streak is already counted and must not climb twice. The very next day:
// one longer. Anything else — a gap, or a run stamped with a day already behind us —
// starts again at one. A run cannot *reduce* a streak, so an out-of-order day starts
// afresh rather than being allowed to rewind anything.
//
// Exported because the achievements ask the question before the run has been folded in:
// they measure against the career as it stood when the run began, so `career.dayStreak`
// does not yet know about today.
export function dayStreakWith(career: Career, day: string): number {
  if (career.lastDay === null) return 1
  if (day === career.lastDay) return career.dayStreak
  if (day === nextDay(career.lastDay)) return career.dayStreak + 1
  return 1
}

// Raises one difficulty's best, or hands the record straight back — both when the run
// did not beat it and when there is no stage to raise, which is every trainee run.
const raise = (
  bests: Record<Difficulty, number>,
  stage: Difficulty | null,
  value: number,
): Record<Difficulty, number> =>
  stage === null || value <= bests[stage] ? bests : { ...bests, [stage]: value }

// Appends a value to a set-like list, or hands the list straight back — both when the
// value is already there and when there is nothing to add. Returning the same array
// matters: `useCareer` only writes when the fold produced something new.
const withValue = (list: string[], value: string | null): string[] =>
  value === null || list.includes(value) ? list : [...list, value]

// Folds a finished run into the career.
//
// Everything here is monotonic except the day streak, which is the one thing that can
// fall — and it falls by starting over, never by going backwards.
export function foldRun(career: Career, run: RunSummary): Career {
  const dayStreak = dayStreakWith(career, run.day)

  // Trainee has no board to be played on, and a run that scored nothing has not put
  // anything on the one it was played on.
  const board =
    run.score > 0 && run.mode !== 'trainee' ? boardKey(run.mode, run.difficulty) : null
  // Which board's mastery the run counts towards. Scoring nothing is no bar here — the
  // mastery figures are about what happened in the run, not about what reached a board.
  const stage = run.mode === 'trainee' ? null : run.difficulty

  return {
    ...career,
    runs: career.runs + 1,
    hits: career.hits + run.hits,
    points: career.points + run.score,
    strikes: career.strikes + run.strikes,
    bestStreakBy: raise(career.bestStreakBy, stage, run.maxStreak),
    bestCleanHitsBy: raise(career.bestCleanHitsBy, stage, run.cleanHits),
    bestParHitsBy: raise(career.bestParHitsBy, stage, run.parHits),
    personalBests: career.personalBests + (run.personalBest ? 1 : 0),
    longestRunMs: Math.max(career.longestRunMs, run.elapsedMs),
    boardsPlayed: withValue(career.boardsPlayed, board),
    modesPlayed: withValue(career.modesPlayed, run.mode),
    difficultiesPlayed: withValue(
      career.difficultiesPlayed,
      run.mode === 'trainee' ? null : run.difficulty,
    ),
    // Only ever forward. A run stamped with an older day — a clock that moved, a queued
    // run flushed late — must not drag the last day back with it.
    lastDay:
      career.lastDay === null || run.day > career.lastDay ? run.day : career.lastDay,
    dayStreak,
    // Trainee is left out: it keeps no board and no score worth the name, so a quiet
    // practice run is not a run that went badly.
    poorRunStreak:
      run.mode === 'trainee'
        ? career.poorRunStreak
        : run.score < POOR_RUN_SCORE
          ? career.poorRunStreak + 1
          : 0,
    bestDayStreak: Math.max(career.bestDayStreak, dayStreak),
  }
}

// Folds a finished multiplayer run in. Its own entry point rather than a flag on
// `RunSummary`: a shared run has no board of its own, sets no personal best and keeps no
// stats, so all it contributes is that it happened and how it went.
export const foldMultiplayer = (
  career: Career,
  { won, players }: { won: boolean; players: number },
): Career => ({
  ...career,
  multiplayerRuns: career.multiplayerRuns + 1,
  multiplayerWins: career.multiplayerWins + (won ? 1 : 0),
  biggestRoom: Math.max(career.biggestRoom, players),
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
