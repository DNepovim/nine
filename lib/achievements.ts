import { isOneOf } from 'narrowland'

import {
  achievement,
  ACHIEVEMENT_IDS,
  type AchievementId,
} from '@/constants/achievements'
import type { AnnouncementId } from '@/lib/announcements'
import { boardKey, dayStreakWith, heldDays, type Career } from '@/lib/career'
import { dayInPrague } from '@/lib/leaderboard-period'
import type { BoardStanding } from '@/lib/medals'
import {
  DIFFICULTY_ORDER,
  SCORED_MODES,
  type Difficulty,
  type Mode,
  type ScoredMode,
  type Stats,
} from '@/machines/game'

// What one run has done so far, or did in the end.
//
// Everything here is about *this* run. Anything cumulative lives on the `Career` beside
// it, and the two are kept apart on purpose: `career` is always the career as it stood
// when the run began, so a rule that wants a lifetime total writes `career.hits +
// run.hits` and means the same thing whether the run is halfway through or over.
type RunFacts = {
  mode: Mode
  difficulty: Difficulty
  score: number
  hits: number
  // The longest streak reached, not the one the run is on.
  maxStreak: number
  // Hits landed before the first life was lost.
  cleanHits: number
  // Hits taken in exactly the optimal number of presses.
  parHits: number
  // The most presses any single landed hit took.
  longestRoute: number
  elapsedMs: number
  // Percentages, 0–100, as the run-stats row shows them.
  avgAccuracy: number
  avgSpeed: number
  personalBest: boolean
  // Whether the run is over. A handful of rules can only be answered once it is.
  finished: boolean
  // When the run ended — read only by the finished rules.
  endedAt: Date
}

export type AchievementFacts = {
  // The career as it stood *before* this run, frozen when the run began.
  career: Career
  // Best score per board, which is what makes the score ladders retroactive: a player
  // who has been playing for months earns their whole ladder the first time this build
  // asks, rather than having to beat their own bests all over again.
  stats: Stats
  run: RunFacts
  // Every board the player stands on, all three periods. The raw standings rather than
  // `toMedals`, which keeps only the best claim per mode — a gold today would vanish
  // behind a bronze all-time, and TOP OF THE BOARD would miss it.
  standings: readonly BoardStanding[]
  // Whether the player holds both Extreme all-time boards — the crown the game-over
  // screen already pays out for. Passed in rather than derived, since `Champions` is the
  // one thing that knows.
  crown: boolean
  // What this run has taken, from the announcement bar's own reckoning.
  crossed: readonly AnnouncementId[]
  tutorialDone: boolean
  now: Date
}

// ── Derived facts ────────────────────────────────────────────────────────────────

// The best this player has ever scored in a mode, on any difficulty — the run included,
// since the run's own score is not in `stats` until the machine folds it in.
const bestIn = (f: AchievementFacts, mode: ScoredMode): number =>
  Math.max(
    f.run.mode === mode ? f.run.score : 0,
    ...DIFFICULTY_ORDER.map((difficulty) => f.stats[mode][difficulty].score),
  )

// The same, on one board rather than across a mode.
const bestOn = (f: AchievementFacts, mode: ScoredMode, difficulty: Difficulty): number =>
  Math.max(
    f.run.mode === mode && f.run.difficulty === difficulty ? f.run.score : 0,
    f.stats[mode][difficulty].score,
  )

// Every board a score has been posted on, this run included.
const boardsPlayed = (f: AchievementFacts): number => {
  const scored = isOneOf(f.run.mode, SCORED_MODES) && f.run.score > 0
  const here = scored ? boardKey(f.run.mode, f.run.difficulty) : null
  return here === null || f.career.boardsPlayed.includes(here)
    ? f.career.boardsPlayed.length
    : f.career.boardsPlayed.length + 1
}

const standingOn = (
  f: AchievementFacts,
  mode: ScoredMode,
  difficulty: Difficulty,
): number | null =>
  f.standings.find(
    (s) => s.mode === mode && s.difficulty === difficulty && s.period === 'ever',
  )?.rank ?? null

// `streakMultiplier` is ×2, ×4 then ×8 capped, so the third extension is the ceiling.
const MAX_MULTIPLIER_STREAK = 3
const TEN_MINUTES_MS = 600_000
const HELD_DAYS = 7
// The small hours, on the player's own clock rather than Prague's: this one is about
// where *they* are, not about which day a score belongs to.
const NIGHT_FROM = 2
const NIGHT_UNTIL = 4

const heldFor = (f: AchievementFacts, mode: ScoredMode, difficulty: Difficulty): number =>
  heldDays(f.career, boardKey(mode, difficulty), f.now)

// ── The rules ────────────────────────────────────────────────────────────────────
//
// One predicate per achievement, over a Record of the id union — so an achievement added
// to the catalogue without a way to earn it is a compile error, the same arrangement
// `announcement-effect.tsx` uses to make an announcement without an effect impossible.
const RULES = {
  firstHit: (f) => f.career.hits + f.run.hits >= 1,
  graduate: (f) => f.tutorialDone,
  firstRun: (f) =>
    f.career.boardsPlayed.length > 0 ||
    (f.run.finished && isOneOf(f.run.mode, SCORED_MODES)),
  allThree: (f) => new Set([...f.career.modesPlayed, f.run.mode]).size >= MODE_COUNT,
  upARung: (f) => playedDifficulty(f, 'hard'),
  intoTheDeep: (f) => playedDifficulty(f, 'extreme'),

  steadyHand: (f) => bestIn(f, 'accuracy') >= 250,
  fineWork: (f) => bestIn(f, 'accuracy') >= 1000,
  surgeon: (f) => bestIn(f, 'accuracy') >= 2500,
  immaculate: (f) => bestIn(f, 'accuracy') >= 5000,
  perfectionist: (f) => bestIn(f, 'accuracy') >= 10000,
  mountaineer: (f) => bestOn(f, 'accuracy', 'extreme') >= 1000,

  fastStart: (f) => bestIn(f, 'speed') >= 250,
  slipstream: (f) => bestIn(f, 'speed') >= 1000,
  afterburner: (f) => bestIn(f, 'speed') >= 2500,
  lightning: (f) => bestIn(f, 'speed') >= 5000,
  terminalVelocity: (f) => bestIn(f, 'speed') >= 10000,
  daredevil: (f) => bestOn(f, 'speed', 'extreme') >= 1000,

  flawlessTen: (f) => Math.max(f.career.bestStreak, f.run.maxStreak) >= 10,
  maxMultiplier: (f) =>
    Math.max(f.career.bestStreak, f.run.maxStreak) >= MAX_MULTIPLIER_STREAK,
  unscathed: (f) => Math.max(f.career.bestCleanHits, f.run.cleanHits) >= 25,
  // Averages only mean something over a run long enough to have an average. Below the
  // floor a single lucky opening hit would read as a perfect run.
  deadEye: (f) => f.run.hits >= 20 && f.run.avgAccuracy >= 95,
  blur: (f) => f.run.hits >= 20 && f.run.avgSpeed >= 90,
  perfectRoute: (f) => f.run.parHits >= 25,

  tenRuns: (f) => finishedRuns(f) >= 10,
  hundredRuns: (f) => finishedRuns(f) >= 100,
  thousandHits: (f) => f.career.hits + f.run.hits >= 1000,
  tenThousandHits: (f) => f.career.hits + f.run.hits >= 10000,
  twoInARow: (f) => dayStreak(f) >= 2,
  sevenDayStreak: (f) => dayStreak(f) >= 7,
  longHaul: (f) => Math.max(f.career.longestRunMs, f.run.elapsedMs) >= TEN_MINUTES_MS,
  allSixBoards: (f) => boardsPlayed(f) >= ALL_BOARD_COUNT,

  onTheBoard: (f) => f.standings.some((s) => s.rank <= 3 && s.score > 0),
  topOfTheBoard: (f) => f.standings.some((s) => s.rank === 1 && s.score > 0),
  untouchable: (f) => f.crown,
  tenBests: (f) => f.career.personalBests + (f.run.personalBest ? 1 : 0) >= 10,
  // Opening the week's board opens the day's too, so either counts.
  earlyBird: (f) => f.crossed.includes('todayFirst') || f.crossed.includes('weekFirst'),

  heldAccEasy: (f) => heldFor(f, 'accuracy', 'easy') >= HELD_DAYS,
  heldAccHard: (f) => heldFor(f, 'accuracy', 'hard') >= HELD_DAYS,
  heldAccExtreme: (f) => heldFor(f, 'accuracy', 'extreme') >= HELD_DAYS,
  heldSpeedEasy: (f) => heldFor(f, 'speed', 'easy') >= HELD_DAYS,
  heldSpeedHard: (f) => heldFor(f, 'speed', 'hard') >= HELD_DAYS,
  heldSpeedExtreme: (f) => heldFor(f, 'speed', 'extreme') >= HELD_DAYS,

  roomForTwo: (f) => f.career.multiplayerRuns >= 1,
  winner: (f) => f.career.multiplayerWins >= 1,
  fullHouse: (f) => f.career.biggestRoom >= 4,

  theLongWay: (f) => f.run.longestRoute >= 30,
  nightShift: (f) => {
    if (!f.run.finished) return false
    const hour = f.run.endedAt.getHours()
    return hour >= NIGHT_FROM && hour < NIGHT_UNTIL
  },
} as const satisfies Record<AchievementId, (facts: AchievementFacts) => boolean>

const MODE_COUNT = 3
const ALL_BOARD_COUNT = SCORED_MODES.length * DIFFICULTY_ORDER.length

const finishedRuns = (f: AchievementFacts): number =>
  f.career.runs + (f.run.finished ? 1 : 0)

// The day streak the player is on *right now*, today included.
//
// `career.dayStreak` does not know about today: the career is frozen as the run begins,
// and only learns the day when the run is folded in at the end. Measuring the live clock
// against the frozen career is exactly what `dayStreakWith` is for, and it means a
// seven-day streak is announced during the seventh run rather than after it.
//
// The day is Prague's, the same clock a score is stamped with, so this and `foldRun` can
// never disagree about which day a run belongs to.
const dayStreak = (f: AchievementFacts): number =>
  dayStreakWith(f.career, dayInPrague(f.now))

const playedDifficulty = (f: AchievementFacts, difficulty: Difficulty): boolean =>
  f.career.difficultiesPlayed.includes(difficulty) ||
  (isOneOf(f.run.mode, SCORED_MODES) && f.run.difficulty === difficulty)

// ── Progress ─────────────────────────────────────────────────────────────────────
//
// How far along a countable achievement is, for the bar on the achievements screen.
// Only the ids carrying a `target` are ever asked; the rest answer 0 and show no bar.
const PROGRESS = {
  firstHit: (f) => f.career.hits + f.run.hits,
  graduate: () => 0,
  firstRun: () => 0,
  allThree: (f) => new Set([...f.career.modesPlayed, f.run.mode]).size,
  upARung: () => 0,
  intoTheDeep: () => 0,

  steadyHand: (f) => bestIn(f, 'accuracy'),
  fineWork: (f) => bestIn(f, 'accuracy'),
  surgeon: (f) => bestIn(f, 'accuracy'),
  immaculate: (f) => bestIn(f, 'accuracy'),
  perfectionist: (f) => bestIn(f, 'accuracy'),
  mountaineer: (f) => bestOn(f, 'accuracy', 'extreme'),

  fastStart: (f) => bestIn(f, 'speed'),
  slipstream: (f) => bestIn(f, 'speed'),
  afterburner: (f) => bestIn(f, 'speed'),
  lightning: (f) => bestIn(f, 'speed'),
  terminalVelocity: (f) => bestIn(f, 'speed'),
  daredevil: (f) => bestOn(f, 'speed', 'extreme'),

  flawlessTen: (f) => Math.max(f.career.bestStreak, f.run.maxStreak),
  maxMultiplier: () => 0,
  unscathed: (f) => Math.max(f.career.bestCleanHits, f.run.cleanHits),
  deadEye: () => 0,
  blur: () => 0,
  perfectRoute: (f) => f.run.parHits,

  tenRuns: (f) => finishedRuns(f),
  hundredRuns: (f) => finishedRuns(f),
  thousandHits: (f) => f.career.hits + f.run.hits,
  tenThousandHits: (f) => f.career.hits + f.run.hits,
  twoInARow: (f) => dayStreak(f),
  sevenDayStreak: (f) => dayStreak(f),
  longHaul: () => 0,
  allSixBoards: (f) => boardsPlayed(f),

  onTheBoard: () => 0,
  topOfTheBoard: () => 0,
  untouchable: () => 0,
  tenBests: (f) => f.career.personalBests + (f.run.personalBest ? 1 : 0),
  earlyBird: () => 0,

  heldAccEasy: (f) => heldFor(f, 'accuracy', 'easy'),
  heldAccHard: (f) => heldFor(f, 'accuracy', 'hard'),
  heldAccExtreme: (f) => heldFor(f, 'accuracy', 'extreme'),
  heldSpeedEasy: (f) => heldFor(f, 'speed', 'easy'),
  heldSpeedHard: (f) => heldFor(f, 'speed', 'hard'),
  heldSpeedExtreme: (f) => heldFor(f, 'speed', 'extreme'),

  roomForTwo: () => 0,
  winner: () => 0,
  fullHouse: (f) => f.career.biggestRoom,

  theLongWay: () => 0,
  nightShift: () => 0,
} as const satisfies Record<AchievementId, (facts: AchievementFacts) => number>

// Every achievement these facts satisfy, in catalogue order.
export const earned = (facts: AchievementFacts): AchievementId[] =>
  ACHIEVEMENT_IDS.filter((id) => RULES[id](facts))

// How far along one achievement is, clamped to its target. Zero for anything that has no
// target, since there is nothing to be part-way through.
export function progressOf(id: AchievementId, facts: AchievementFacts): number {
  const target = achievement(id).target
  if (target === undefined) return 0
  return Math.min(target, Math.max(0, PROGRESS[id](facts)))
}

export const isEarnedBy = (id: AchievementId, facts: AchievementFacts): boolean =>
  RULES[id](facts)

// A rank of 1 on a board's all-time list, or null for a board the player is not on. The
// achievements themselves do not read this — the career's `heldSince` is what watches
// the boards — but the hook that feeds `observeHeld` needs exactly this question asked
// once per board, and asking it here keeps the definition of "holding" in one place.
export const holdsBoard = (
  f: AchievementFacts,
  mode: ScoredMode,
  difficulty: Difficulty,
): boolean => standingOn(f, mode, difficulty) === 1
