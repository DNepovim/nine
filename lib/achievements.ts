import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { isOneOf } from 'narrowland'

import {
  achievement,
  ACHIEVEMENT_IDS,
  type AchievementId,
  type StageAxis,
} from '@/constants/achievements'
import type { AnnouncementId } from '@/lib/announcements'
import { boardKey, dayStreakWith, heldDays, type Career } from '@/lib/career'
import { dayInPrague } from '@/lib/leaderboard-period'
import type { BoardStanding } from '@/lib/medals'
import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  SCORED_MODES,
  type Difficulty,
  type Mode,
  type ScoredMode,
  type Stats,
} from '@/machines/game'
import { MAX_ROOM_PLAYERS } from '@/types/multiplayer'

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
// The same, on one board rather than across a mode.
const bestOn = (f: AchievementFacts, mode: ScoredMode, difficulty: Stage): number => {
  const board = asDifficulty(difficulty)
  if (board === null) return 0
  return Math.max(
    f.run.mode === mode && f.run.difficulty === board ? f.run.score : 0,
    f.stats[mode][board].score,
  )
}

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

// One side of a staged achievement, along whichever axis it is staged. A difficulty for
// almost all of them; a mode for the ones whose rule already names a board.
export type Stage = Difficulty | ScoredMode

// What each axis is made of, in the order its stages are drawn — easiest board first,
// modes in catalogue order.
export const STAGE_AXES = {
  difficulty: DIFFICULTY_ORDER,
  mode: SCORED_MODES,
} as const satisfies Record<StageAxis, readonly Stage[]>

// The short label a stage wears beside its bar and after an achievement's name. The
// difficulty codes are the board's own, so a stage reads the same here as on the
// difficulty selector; the modes get three letters for the same reason — a 7px label
// beside a 3px bar has no room for ACCURACY.
export const STAGE_CODE = {
  easy: DIFFICULTIES.easy.code,
  hard: DIFFICULTIES.hard.code,
  extreme: DIFFICULTIES.extreme.code,
  accuracy: msg`ACC`,
  speed: msg`SPD`,
} as const satisfies Record<Stage, MessageDescriptor>

// A stage narrowed to a difficulty, or null where it is a mode.
//
// This is what keeps the mode axis away from the twenty rules written against boards:
// they take a `Stage` like everything else, and the helpers below answer zero for a
// stage their question cannot be asked of. No rule is ever actually asked across axes —
// `awardsOf` only offers an achievement its own — so the null branch is unreachable, and
// this makes that the type system's problem rather than a comment's.
const asDifficulty = (stage: Stage): Difficulty | null =>
  isOneOf(stage, DIFFICULTY_ORDER) ? stage : null

const heldFor = (f: AchievementFacts, mode: ScoredMode, difficulty: Stage): number => {
  const board = asDifficulty(difficulty)
  return board === null ? 0 : heldDays(f.career, boardKey(mode, board), f.now)
}

// Whether the run being played is on the board a stage stands for. Trainee clears no
// stage at all: it has no difficulty selector, so whatever difficulty it carries says
// nothing about which board the run belongs to.
const runOnStage = (f: AchievementFacts, stage: Stage): boolean =>
  isOneOf(f.run.mode, SCORED_MODES) && f.run.difficulty === stage

// The mastery figures for one board — the career's record there, and the live run when
// the run is on that board. The same shape as `bestOn` for the score ladders: what the
// player has ever managed here, run included, since the career does not know about the
// run until it ends.
const streakOn = (f: AchievementFacts, stage: Stage): number => {
  const board = asDifficulty(stage)
  if (board === null) return 0
  return Math.max(
    f.career.bestStreakBy[board],
    runOnStage(f, stage) ? f.run.maxStreak : 0,
  )
}

const cleanHitsOn = (f: AchievementFacts, stage: Stage): number => {
  const board = asDifficulty(stage)
  if (board === null) return 0
  return Math.max(
    f.career.bestCleanHitsBy[board],
    runOnStage(f, stage) ? f.run.cleanHits : 0,
  )
}

const parHitsOn = (f: AchievementFacts, stage: Stage): number => {
  const board = asDifficulty(stage)
  if (board === null) return 0
  return Math.max(f.career.bestParHitsBy[board], runOnStage(f, stage) ? f.run.parHits : 0)
}

// Whether the player stands no worse than `rank` on a board of this difficulty — either
// mode, any period — with a real score behind it. What the two staged board achievements
// are asked, and the reason staging them is worth anything: a podium on Easy and a podium
// on Extreme were the same row until now.
const standsAt = (f: AchievementFacts, stage: Stage, rank: number): boolean =>
  f.standings.some((s) => s.difficulty === stage && s.rank <= rank && s.score > 0)

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
  // A hit rather than a board opened: Extreme is the one rung where turning up is
  // not the achievement. Asked of the run alone — the career remembers which
  // difficulties were played, not where a hit landed, so a player who opened Extreme
  // before this earns it on their next landed target there.
  // Staged by mode: the stage *is* which Extreme board, so the run has to be on that
  // mode's rather than merely on someone's.
  intoTheDeep: (f, stage) =>
    f.run.mode === stage && f.run.difficulty === 'extreme' && f.run.hits >= 1,

  steadyHand: (f, stage) => bestOn(f, 'accuracy', stage) >= 250,
  fineWork: (f, stage) => bestOn(f, 'accuracy', stage) >= 1000,
  surgeon: (f, stage) => bestOn(f, 'accuracy', stage) >= 2500,
  immaculate: (f, stage) => bestOn(f, 'accuracy', stage) >= 5000,
  perfectionist: (f, stage) => bestOn(f, 'accuracy', stage) >= 10000,

  fastStart: (f, stage) => bestOn(f, 'speed', stage) >= 250,
  slipstream: (f, stage) => bestOn(f, 'speed', stage) >= 1000,
  afterburner: (f, stage) => bestOn(f, 'speed', stage) >= 2500,
  lightning: (f, stage) => bestOn(f, 'speed', stage) >= 5000,
  terminalVelocity: (f, stage) => bestOn(f, 'speed', stage) >= 10000,

  flawlessTen: (f, stage) => streakOn(f, stage) >= 10,
  maxMultiplier: (f, stage) => streakOn(f, stage) >= MAX_MULTIPLIER_STREAK,
  unscathed: (f, stage) => cleanHitsOn(f, stage) >= 25,
  // Averages only mean something over a run long enough to have an average. Below the
  // floor a single lucky opening hit would read as a perfect run. These two keep no
  // career record — an average belongs to the run that had it — so the run on the board
  // is the only thing that can clear their stage.
  deadEye: (f, stage) =>
    runOnStage(f, stage) && f.run.hits >= 20 && f.run.avgAccuracy >= 95,
  blur: (f, stage) => runOnStage(f, stage) && f.run.hits >= 20 && f.run.avgSpeed >= 90,
  perfectRoute: (f, stage) => parHitsOn(f, stage) >= 25,

  tenRuns: (f) => finishedRuns(f) >= 10,
  hundredRuns: (f) => finishedRuns(f) >= 100,
  thousandHits: (f) => f.career.hits + f.run.hits >= 1000,
  tenThousandHits: (f) => f.career.hits + f.run.hits >= 10000,
  twoInARow: (f) => dayStreak(f) >= 2,
  sevenDayStreak: (f) => dayStreak(f) >= 7,
  longHaul: (f) => Math.max(f.career.longestRunMs, f.run.elapsedMs) >= TEN_MINUTES_MS,
  allSixBoards: (f) => boardsPlayed(f) >= ALL_BOARD_COUNT,

  onTheBoard: (f, stage) => standsAt(f, stage, 3),
  topOfTheBoard: (f, stage) => standsAt(f, stage, 1),
  untouchable: (f) => f.crown,
  tenBests: (f) => f.career.personalBests + (f.run.personalBest ? 1 : 0) >= 10,
  // Opening the week's board opens the day's too, so either counts.
  earlyBird: (f) => f.crossed.includes('todayFirst') || f.crossed.includes('weekFirst'),

  heldAccuracy: (f, stage) => heldFor(f, 'accuracy', stage) >= HELD_DAYS,
  heldSpeed: (f, stage) => heldFor(f, 'speed', stage) >= HELD_DAYS,

  roomForTwo: (f) => f.career.multiplayerRuns >= 1,
  winner: (f) => f.career.multiplayerWins >= 1,
  fullHouse: (f) => f.career.biggestRoom >= MAX_ROOM_PLAYERS,

  theLongWay: (f) => f.run.longestRoute >= 30,
  nightShift: (f) => {
    if (!f.run.finished) return false
    const hour = f.run.endedAt.getHours()
    return hour >= NIGHT_FROM && hour < NIGHT_UNTIL
  },
} as const satisfies Record<
  AchievementId,
  // `stage` is the board being asked about. Unstaged rules ignore it and are asked once
  // with `'easy'`, which they never read — the alternative was two tables that could
  // drift, or a union every call site had to narrow.
  (facts: AchievementFacts, stage: Stage) => boolean
>

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

  steadyHand: (f, stage) => bestOn(f, 'accuracy', stage),
  fineWork: (f, stage) => bestOn(f, 'accuracy', stage),
  surgeon: (f, stage) => bestOn(f, 'accuracy', stage),
  immaculate: (f, stage) => bestOn(f, 'accuracy', stage),
  perfectionist: (f, stage) => bestOn(f, 'accuracy', stage),

  fastStart: (f, stage) => bestOn(f, 'speed', stage),
  slipstream: (f, stage) => bestOn(f, 'speed', stage),
  afterburner: (f, stage) => bestOn(f, 'speed', stage),
  lightning: (f, stage) => bestOn(f, 'speed', stage),
  terminalVelocity: (f, stage) => bestOn(f, 'speed', stage),

  flawlessTen: (f, stage) => streakOn(f, stage),
  maxMultiplier: () => 0,
  unscathed: (f, stage) => cleanHitsOn(f, stage),
  deadEye: () => 0,
  blur: () => 0,
  perfectRoute: (f, stage) => parHitsOn(f, stage),

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

  heldAccuracy: (f, stage) => heldFor(f, 'accuracy', stage),
  heldSpeed: (f, stage) => heldFor(f, 'speed', stage),

  roomForTwo: () => 0,
  winner: () => 0,
  fullHouse: (f) => f.career.biggestRoom,

  theLongWay: () => 0,
  nightShift: () => 0,
} as const satisfies Record<
  AchievementId,
  (facts: AchievementFacts, stage: Stage) => number
>

// One thing a player can achieve: an achievement, and for a staged one the board it was
// cleared on. `stage` is null for the rest, which are achieved once and have no board.
export type Award = { id: AchievementId; stage: Stage | null }

// The stable name for an award, so a set can hold it and the store can key on it.
export const awardKey = ({ id, stage }: Award): string =>
  stage === null ? id : `${id}:${stage}`

// Every stage a staged achievement can be cleared on, or the single unstaged award.
export const awardsOf = (id: AchievementId): Award[] => {
  const axis = achievement(id).staged
  if (axis === undefined) return [{ id, stage: null }]
  return STAGE_AXES[axis].map((stage) => ({ id, stage }))
}

// Every award these facts satisfy, in catalogue order and then easiest board first.
export const earned = (facts: AchievementFacts): Award[] =>
  ACHIEVEMENT_IDS.flatMap((id) =>
    awardsOf(id).filter((award) => RULES[id](facts, award.stage ?? 'easy')),
  )

// How far along one achievement is on one board, clamped to its target. Zero for
// anything that has no target, since there is nothing to be part-way through.
export function progressOf(
  id: AchievementId,
  facts: AchievementFacts,
  stage: Stage = 'easy',
): number {
  const target = achievement(id).target
  if (target === undefined) return 0
  return Math.min(target, Math.max(0, PROGRESS[id](facts, stage)))
}

// The stage an achievement is asked about when the caller does not name one: the first
// along its own axis. 'easy' for the board-staged ones, as it always was, and Accuracy
// for a mode-staged one — where 'easy' is not a stage at all and would ask a question
// the rule can only answer no to.
const firstStageOf = (id: AchievementId): Stage => {
  const axis = achievement(id).staged
  return axis === undefined ? 'easy' : STAGE_AXES[axis][0]
}

export const isEarnedBy = (
  id: AchievementId,
  facts: AchievementFacts,
  stage: Stage = firstStageOf(id),
): boolean => RULES[id](facts, stage)

// A rank of 1 on a board's all-time list, or null for a board the player is not on. The
// achievements themselves do not read this — the career's `heldSince` is what watches
// the boards — but the hook that feeds `observeHeld` needs exactly this question asked
// once per board, and asking it here keeps the definition of "holding" in one place.
export const holdsBoard = (
  f: AchievementFacts,
  mode: ScoredMode,
  difficulty: Difficulty,
): boolean => standingOn(f, mode, difficulty) === 1

// How far along an achievement is on each board — what the row's three bars read.
//
// An unstaged achievement answers the same number three times: its rule never looks at
// the board it is handed. Total rather than optional, so a caller cannot forget a board
// and quietly draw an empty bar.
export const stageProgress = (
  id: AchievementId,
  facts: AchievementFacts,
): Record<Stage, number> => ({
  easy: progressOf(id, facts, 'easy'),
  hard: progressOf(id, facts, 'hard'),
  extreme: progressOf(id, facts, 'extreme'),
  accuracy: progressOf(id, facts, 'accuracy'),
  speed: progressOf(id, facts, 'speed'),
})
