import { i18n, type MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { isOneOf } from 'narrowland'

import {
  achievement,
  ACHIEVEMENT_IDS,
  type AchievementId,
  type StageAxis,
} from '@/constants/achievements'
import {
  announcementFor,
  type Announcement,
  type AnnouncementId,
} from '@/lib/announcements'
import {
  boardKey,
  dayStreakWith,
  heldDays,
  POOR_RUN_SCORE,
  type Career,
} from '@/lib/career'
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
export type RunFacts = {
  // Which mode the run is in, and null when there is no run.
  //
  // Between two runs the machine still holds the last one's score, hits and streak —
  // `freshGame` clears them as the next run starts, not as the last one ended — while
  // `mode` and `difficulty` follow whatever the intro screen is now showing. Handed to
  // the rules as one run, those two halves are a run nobody played: 15 000 in Accuracy
  // on Easy cleared TERMINAL VELOCITY on Speed Extreme, on a board the player had not
  // touched. So a run that is not happening names no mode, and `NO_RUN` below is the
  // only shape the rest of the app may say that in.
  mode: Mode | null
  // Never read without the mode beside it — every rule that asks which board a run is
  // on asks whether there is a run first — so no run leaves this at Easy rather than
  // making every one of them narrow a second null.
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

// No run at all: the intro screen, between two of them.
//
// Every figure is zero rather than the last run's, because the last run is already in
// the career and the stats by the time this is asked — the machine's context is simply
// still holding it. A rule that reads the run from here learns nothing, which is the
// right amount to learn about a run that is not happening.
export const NO_RUN: RunFacts = {
  mode: null,
  difficulty: 'easy',
  score: 0,
  hits: 0,
  maxStreak: 0,
  cleanHits: 0,
  parHits: 0,
  longestRoute: 0,
  elapsedMs: 0,
  avgAccuracy: 0,
  avgSpeed: 0,
  personalBest: false,
  finished: false,
  // Read only by the finished rules, and this run never finished.
  endedAt: new Date(0),
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
  guideRead: boolean
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

// One of the six boards, and whether a score has ever been posted on it — this run
// included, since the career does not know about the run until it ends.
export type BoardMark = { mode: ScoredMode; difficulty: Difficulty; posted: boolean }

// All six, in the app's own order: mode, then easiest difficulty first.
const boardsPosted = (f: AchievementFacts): BoardMark[] => {
  const here =
    isOneOf(f.run.mode, SCORED_MODES) && f.run.score > 0
      ? boardKey(f.run.mode, f.run.difficulty)
      : null
  return SCORED_MODES.flatMap((mode) =>
    DIFFICULTY_ORDER.map((difficulty) => {
      const key = boardKey(mode, difficulty)
      return {
        mode,
        difficulty,
        posted: key === here || f.career.boardsPlayed.includes(key),
      }
    }),
  )
}

// Every board a score has been posted on, this run included. Counted off the same six
// marks the row draws, so the number and the boards beside it cannot disagree.
const boardsPlayed = (f: AchievementFacts): number =>
  boardsPosted(f).filter((board) => board.posted).length

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

// Whether the player stands first all-time on one board. THE OWL and THE EAGLE ask it
// of a mode's Extreme board — where standing first is what the bird means — and the hook
// that feeds `observeHeld` asks it once per board; one definition of "holding", so a bird
// awarded and a hold being timed can never disagree about it.
export const holdsBoard = (
  f: AchievementFacts,
  mode: ScoredMode,
  difficulty: Difficulty,
): boolean => standingOn(f, mode, difficulty) === 1

// A run that barely happened, as the career counts them. Asked of the live run as well,
// since the rules read the career as it stood before it — see `POOR_RUN_SCORE` for what
// "barely" is and why the number lives over there.
const poorRuns = (f: AchievementFacts): number =>
  f.career.poorRunStreak +
  (f.run.finished && isOneOf(f.run.mode, SCORED_MODES) && f.run.score < POOR_RUN_SCORE
    ? 1
    : 0)

// A number that reads the same backwards. Four digits or more, so every score under a
// thousand is not quietly a palindrome — 77 is a small number, not a curiosity.
const readsBothWays = (score: number): boolean => {
  const digits = String(score)
  if (digits.length < PALINDROME_DIGITS) return false
  return Array.from(digits).every((digit, i) => digit === digits[digits.length - 1 - i])
}

// ── The rules ────────────────────────────────────────────────────────────────────
//
// One predicate per achievement, over a Record of the id union — so an achievement added
// to the catalogue without a way to earn it is a compile error, the same arrangement
// `announcement-effect.tsx` uses to make an announcement without an effect impossible.
const RULES = {
  firstHit: (f) => f.career.hits + f.run.hits >= 1,
  graduate: (f) => f.guideRead,
  firstRun: (f) =>
    f.career.boardsPlayed.length > 0 ||
    (f.run.finished && isOneOf(f.run.mode, SCORED_MODES)),
  allThree: (f) => modesPlayed(f).size >= MODE_COUNT,
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
  theOwl: (f) => holdsBoard(f, 'accuracy', 'extreme'),
  theEagle: (f) => holdsBoard(f, 'speed', 'extreme'),
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
  // Trainee never ends and keeps no score, so the runs that can finish on nothing are
  // the scored ones — which is also the only place scoring nothing means anything.
  gooseEgg: (f) =>
    f.run.finished && isOneOf(f.run.mode, SCORED_MODES) && f.run.score === 0,
  inAndOut: (f) => f.run.finished && f.run.elapsedMs < SHORT_VISIT_MS,
  roughPatch: (f) => poorRuns(f) >= POOR_RUN_STREAK,
  // Not waited for the end: a run this slow twenty targets in is not going to speed up,
  // and the joke lands better while it is still happening.
  scenicRoute: (f) =>
    f.run.mode === 'speed' && f.run.hits >= SCENIC_HITS && f.run.avgSpeed < SCENIC_SPEED,
  eternalStudent: (f) => f.run.mode === 'trainee' && f.run.elapsedMs >= HALF_HOUR_MS,
  touchGrass: (f) => Math.max(f.career.longestRunMs, f.run.elapsedMs) >= AN_HOUR_MS,
  roundNumber: (f) =>
    f.run.finished && f.run.score > 0 && f.run.score % ROUND_SCORE === 0,
  palindrome: (f) => f.run.finished && readsBothWays(f.run.score),
  nineNineNine: (f) => f.career.hits + f.run.hits >= NINE_HUNDRED_NINETY_NINE,
  goodSport: (f) =>
    f.career.multiplayerRuns >= GOOD_SPORT_ROOMS && f.career.multiplayerWins === 0,
  noJoke: (f) =>
    f.run.finished &&
    f.run.endedAt.getMonth() === APRIL &&
    f.run.endedAt.getDate() === FOOLS_DAY,
} as const satisfies Record<
  AchievementId,
  // `stage` is the board being asked about. Unstaged rules ignore it and are asked once
  // with `'easy'`, which they never read — the alternative was two tables that could
  // drift, or a union every call site had to narrow.
  (facts: AchievementFacts, stage: Stage) => boolean
>

const MODE_COUNT = 3
const ALL_BOARD_COUNT = SCORED_MODES.length * DIFFICULTY_ORDER.length

// The secret ones' numbers. Each is arbitrary in the way a punchline is — the joke is
// that the app was counting at all — so they are named here rather than left in the
// rules, where a bare 1_800_000 says nothing about what it is measuring.
const SHORT_VISIT_MS = 10_000
const HALF_HOUR_MS = 1_800_000
const AN_HOUR_MS = 3_600_000
const POOR_RUN_STREAK = 5
const SCENIC_HITS = 20
const SCENIC_SPEED = 20
const ROUND_SCORE = 1000
const PALINDROME_DIGITS = 4
const NINE_HUNDRED_NINETY_NINE = 999
const GOOD_SPORT_ROOMS = 5
// `getMonth` counts from zero, which is the whole reason this is named.
const APRIL = 3
const FOOLS_DAY = 1

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

// Every mode the player has ever played, the live run's own included — the career only
// hears about a run when it ends, and a run in progress is a mode played. No run adds
// nothing: standing on the intro screen with Speed selected is not playing Speed.
const modesPlayed = (f: AchievementFacts): Set<string> =>
  new Set(
    f.run.mode === null ? f.career.modesPlayed : [...f.career.modesPlayed, f.run.mode],
  )

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
  allThree: (f) => modesPlayed(f).size,
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
  theOwl: () => 0,
  theEagle: () => 0,
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
  gooseEgg: () => 0,
  inAndOut: () => 0,
  roughPatch: () => 0,
  scenicRoute: () => 0,
  eternalStudent: () => 0,
  touchGrass: () => 0,
  roundNumber: () => 0,
  palindrome: () => 0,
  nineNineNine: () => 0,
  goodSport: () => 0,
  noJoke: () => 0,
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

// The line the bar shouts when one is achieved.
//
// The emblem and the title, upper-cased, so the emblem says which one it is before the
// words are read and the title is the only thing shouting — the same arrangement the
// rival lines use for a nickname. `roll` picks the wording the way every other line is
// picked, and the achievement itself travels with the line so a tap on the bar can open
// its card.
export const achievementAnnouncement = (
  id: AchievementId,
  roll: number,
): Announcement => ({
  ...announcementFor(
    'achievement',
    roll,
    `${achievement(id).emblem} ${i18n._(achievement(id).title).toUpperCase()}`,
  ),
  achievement: id,
})

// The pages a detail card opens over, and which of them to open on.
//
// One page per achievement rather than per award: two stages of the same one are two
// chips and a single card, since the card is about the achievement. The order is the
// order the awards came in, so the pages read the way the chips do.
//
// An achievement the run has not earned — the announcement bar tapped for one that
// arrived after the list was read — opens on its own rather than being dropped, which is
// also what answers a run that earned nothing else.
export const achievementCard = (
  awards: readonly Award[],
  asked: AchievementId,
): { ids: readonly AchievementId[]; start: number } => {
  const ids = [...new Set(awards.map((award) => award.id))]
  const start = ids.indexOf(asked)
  return start === -1 ? { ids: [asked], start: 0 } : { ids, start }
}

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

// Which of the six boards an achievement is spread over, or null for the ones that are
// not about the boards at all.
//
// Only ALL SIX BOARDS is: its rule counts boards rather than stages, so the row's own
// three bars cannot say which of the six are done and a bare 4/6 does not either. The
// question belongs here, beside the rule that asks it, rather than in a view that would
// have to know what the achievement means.
export const boardMarks = (
  id: AchievementId,
  facts: AchievementFacts,
): BoardMark[] | null => (id === 'allSixBoards' ? boardsPosted(facts) : null)

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
