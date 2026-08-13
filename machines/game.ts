import { isNonEmptyArray } from 'narrowland'
import { assign, createMachine } from 'xstate'

import {
  DIFFICULTIES,
  FAST_HIT_THRESHOLD,
  MODES,
  rampedTimeout,
  streakMultiplier,
  type Difficulty,
  type Mode,
  type StreakTrigger,
} from './modes'
import { accuracyFactor, computeHitPoints, computePar, speedFactor } from './scoring'

export type { Difficulty, Mode, ScoredMode } from './modes'
export {
  ARCADE_TEASER,
  DARK_MODE_GRADIENT,
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  getDifficultyColor,
  lerpColor,
  MODE_DESCRIPTIONS,
  MODE_GRADIENT,
  MODE_ORDER,
  MODES,
  SCORED_MODES,
  effectiveSpawnInterval,
  effectiveTimeout,
  streakMultiplier,
} from './modes'

export type Grid = [
  [number, number, number],
  [number, number, number],
  [number, number, number],
]

export type Target = {
  id: number
  value: number
  spawnedAt: number // ms timestamp — drives the countdown / speed factor
  // The clock this target was given, fixed when it spawned. Stored per target rather
  // than read from the mode, because Speed's timeout shrinks as the run goes on and a
  // target already in flight must keep the ring it started with.
  duration: number
  refAt: number // reference moment (spawn, or the last time any target was hit)
  refGrid: Grid // dial snapshot at the reference moment
  par: number // optimal steps from refGrid to value (fixed at reference time)
  userSteps: number // button changes since the reference moment
}

type DifficultyStats = { score: number; hits: number; accSum?: number; spdSum?: number }
export type Stats = Record<Mode, Record<Difficulty, DifficultyStats>>

const emptyDifficultyStats = (): Record<Difficulty, DifficultyStats> => ({
  easy: { score: 0, hits: 0 },
  hard: { score: 0, hits: 0 },
  extreme: { score: 0, hits: 0 },
})

const emptyStats = (): Stats => ({
  trainee: emptyDifficultyStats(),
  accuracy: emptyDifficultyStats(),
  speed: emptyDifficultyStats(),
})

// One hit's worth of feedback for the UI's floating "+points" animation.
export type HitInfo = {
  points: number
  progress: number
  bonus: boolean
  multiplier: number
  accFactor: number
  spdFactor: number
  // What the hit cost and what it could have cost. The accuracy factor blends the
  // two into a fraction; Trainee's coach needs the figures themselves to be able to
  // say "4 would have done".
  steps: number
  par: number
}
export type HitBatch = { seq: number; hits: HitInfo[] }

export function computeSum(grid: Grid): number {
  return grid.reduce(
    (sum, row, r) => sum + row.reduce((s, val, c) => s + val * (r + 1) * (c + 1), 0),
    0,
  )
}

const initialGrid: Grid = [
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
]

type Context = {
  grid: Grid
  hits: number
  score: number
  stats: Stats // best { score, hits } per mode × difficulty (best by score)
  mode: Mode
  difficulty: Difficulty
  lives: number
  streak: number
  // Hits that landed on a streak, over the whole run — `streak` only knows the one
  // running now. It is what says whether a run was played well or merely played.
  strikes: number
  accSum: number
  spdSum: number
  targets: Target[]
  nextTargetId: number
  hitBatch: HitBatch
}

type Event =
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'RESTART' }
  | { type: 'MENU' }
  | { type: 'SET_MODE'; mode: Mode }
  | { type: 'SET_DIFFICULTY'; difficulty: Difficulty }
  | { type: 'HYDRATE_STATS'; stats: Partial<Stats> }
  | { type: 'PRESS'; index: number; delta: 1 | -1; now: number }
  | { type: 'SET_CELL'; index: number; value: number; now: number }
  | { type: 'ADD_TARGET'; value: number; at: number }
  | { type: 'TARGET_EXPIRED'; id: number }

// The machine's `send` function, for hooks that dispatch events.
export type GameSend = (event: Event) => void

// Per-game reset; mode, difficulty and stats are intentionally omitted so assign
// leaves them untouched.
//
// The hit batch is emptied but keeps its seq. The seq keys the UI's celebration and
// floating-point animations, so it has to keep climbing across games — but the hits
// themselves describe a press made in the *previous* run, and possibly in another
// mode, since nothing else clears them. Carrying them into a new run opened it with
// a stale hit already on Trainee's stat row and still able to earn a confetti
// shower, before the player had touched the dial.
const freshGame = (mode: Mode, seq: number) => ({
  grid: initialGrid,
  hits: 0,
  score: 0,
  lives: MODES[mode].lives,
  streak: 0,
  strikes: 0,
  accSum: 0,
  spdSum: 0,
  targets: [] as Target[],
  nextTargetId: 0,
  hitBatch: { seq, hits: [] as HitInfo[] },
})

const bestByScore = (
  prev: DifficultyStats,
  score: number,
  hits: number,
  accSum: number,
  spdSum: number,
): DifficultyStats => (score > prev.score ? { score, hits, accSum, spdSum } : prev)

// Exported because Trainee's coach applies a press itself, to compare the route
// before against the route after while the machine's snapshot still holds the grid
// from before. A third copy of the wrap arithmetic was the alternative.
export function buildPressGrid(grid: Grid, index: number, delta: 1 | -1): Grid {
  const row = Math.floor(index / 3)
  const col = index % 3
  return grid.map((r, ri) =>
    r.map((v, ci) => {
      if (ri !== row || ci !== col) return v
      return (((v + delta) % 10) + 10) % 10
    }),
  ) as Grid
}

export function buildSetGrid(grid: Grid, index: number, value: number): Grid {
  const row = Math.floor(index / 3)
  const col = index % 3
  return grid.map((r, ri) =>
    r.map((v, ci) => (ri === row && ci === col ? value : v)),
  ) as Grid
}

// What a hit batch did, as far as the streak rules care.
type StreakFacts = {
  anyHit: boolean
  allOptimal: boolean
  allFast: boolean
  clearedBoard: boolean
}

// Whether a hit batch extends the streak. One predicate per trigger, so adding a
// mode's rule means adding a row here rather than another branch in a conditional.
const STREAK_TRIGGERED = {
  optimal: ({ anyHit, allOptimal }) => anyHit && allOptimal,
  fast: ({ anyHit, allFast }) => anyHit && allFast,
  clear: ({ clearedBoard }) => clearedBoard,
  none: () => false,
} as const satisfies Record<StreakTrigger, (facts: StreakFacts) => boolean>

// Whether a hit batch breaks it. A streak only feels like a chain when both halves
// are in play: `optimal` and `fast` are broken by a matching hit that missed the
// mark, where `clear` is never broken by a hit — only by a target running out.
const STREAK_BROKEN = {
  optimal: ({ anyHit }) => anyHit,
  fast: ({ anyHit }) => anyHit,
  clear: () => false,
  none: () => false,
} as const satisfies Record<StreakTrigger, (facts: StreakFacts) => boolean>

// Applies a new grid: scores any targets whose value equals the new sum, resets
// the reference for surviving targets when a hit happened, applies streak multiplier,
// and emits a hit batch for the UI.
function applyGrid(context: Context, newGrid: Grid, now: number) {
  const newSum = computeSum(newGrid)
  const matched = context.targets.filter((t) => t.value === newSum)
  const remaining = context.targets.filter((t) => t.value !== newSum)
  const anyHit = isNonEmptyArray(matched)
  const clearedBoard = anyHit && remaining.length === 0

  const mode = MODES[context.mode]

  let rawScore = 0
  let allOptimal = isNonEmptyArray(matched)
  let allFast = isNonEmptyArray(matched)
  let accAdded = 0
  let spdAdded = 0
  const perTarget: {
    points: number
    progress: number
    accFactor: number
    spdFactor: number
    steps: number
    par: number
  }[] = []

  for (const t of matched) {
    const userSteps = t.userSteps + 1
    // Each target is scored against the clock it was given, not the run's current one.
    const timeLeft = Math.max(0, t.duration - (now - t.spawnedAt))
    const progress = t.duration > 0 ? Math.min(1, Math.max(0, timeLeft / t.duration)) : 0
    const pts = computeHitPoints({
      par: t.par,
      userSteps,
      timeLeft,
      duration: t.duration,
      weights: mode.weights,
    })
    const acc = accuracyFactor(t.par, userSteps)
    const spd = speedFactor(timeLeft, t.duration)
    if (userSteps !== t.par) allOptimal = false
    if (spd < FAST_HIT_THRESHOLD) allFast = false
    accAdded += acc
    spdAdded += spd
    rawScore += pts
    perTarget.push({
      points: pts,
      progress,
      accFactor: acc,
      spdFactor: spd,
      steps: userSteps,
      par: t.par,
    })
  }

  const streakFacts = { anyHit, allOptimal, allFast, clearedBoard }
  const triggered = STREAK_TRIGGERED[mode.streak](streakFacts)
  let streak = context.streak
  let multiplier = 1
  if (mode.streak === 'none') {
    multiplier = clearedBoard ? 2 : 1 // legacy trainee behavior
  } else if (triggered) {
    streak = context.streak + 1
    multiplier = streakMultiplier(streak)
  } else if (STREAK_BROKEN[mode.streak](streakFacts)) {
    streak = 0
  } // a miss leaves the streak alone; only expiry clears it outright

  const addedScore = Math.round(rawScore * multiplier)
  const hitInfos: HitInfo[] = perTarget.map((p) => ({
    points: Math.round(p.points * multiplier),
    progress: p.progress,
    bonus: multiplier > 1,
    multiplier,
    accFactor: p.accFactor,
    spdFactor: p.spdFactor,
    steps: p.steps,
    par: p.par,
  }))

  const hits = context.hits + matched.length
  // Every target in a triggering press counts: the multiplier applied to all of them,
  // and each one wears the ×N badge as it floats up.
  const strikes = context.strikes + (multiplier > 1 ? matched.length : 0)
  const score = context.score + addedScore

  // Surviving targets: a hit resets their reference (and par) to now; otherwise
  // this press is just one more step toward them.
  const targets = remaining.map((t) =>
    anyHit
      ? {
          ...t,
          refAt: now,
          refGrid: newGrid,
          par: computePar(newGrid, t.value),
          userSteps: 0,
        }
      : { ...t, userSteps: t.userSteps + 1 },
  )

  const newAccSum = context.accSum + accAdded
  const newSpdSum = context.spdSum + spdAdded

  // Trainee keeps no best. It is a practice mode with no board, and tracking one
  // meant the personal-best celebration fired on the first hit of a later run —
  // practice runs are short, so the stored best was low enough to clear at once.
  const stats =
    anyHit && context.mode !== 'trainee'
      ? {
          ...context.stats,
          [context.mode]: {
            ...context.stats[context.mode],
            [context.difficulty]: bestByScore(
              context.stats[context.mode][context.difficulty],
              score,
              hits,
              newAccSum,
              newSpdSum,
            ),
          },
        }
      : context.stats

  const hitBatch = anyHit
    ? { seq: context.hitBatch.seq + 1, hits: hitInfos }
    : context.hitBatch

  // Accuracy mode: lose a life when hitting a target with < 20 % accuracy factor.
  let newLives = context.lives
  if (context.mode === 'accuracy' && anyHit && perTarget.some((p) => p.accFactor < 0.2)) {
    newLives = Math.max(0, context.lives - 1)
  }

  return {
    grid: newGrid,
    targets,
    hits,
    score,
    streak,
    strikes,
    accSum: newAccSum,
    spdSum: newSpdSum,
    stats,
    hitBatch,
    lives: newLives,
  }
}

export const gameMachine = createMachine({
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- the assertion supplies XState's context/event generics
  types: {} as { context: Context; events: Event },
  id: 'game',
  initial: 'menu',
  context: {
    grid: initialGrid,
    hits: 0,
    score: 0,
    stats: emptyStats(),
    mode: 'accuracy' as Mode,
    difficulty: 'hard' as Difficulty,
    lives: 3,
    streak: 0,
    strikes: 0,
    accSum: 0,
    spdSum: 0,
    targets: [] as Target[],
    nextTargetId: 0,
    hitBatch: { seq: 0, hits: [] as HitInfo[] },
  } satisfies Context,
  on: {
    // Load persisted per-mode×difficulty stats on app start.
    HYDRATE_STATS: {
      actions: assign(
        ({
          context,
          event,
        }: {
          context: Context
          event: Extract<Event, { type: 'HYDRATE_STATS' }>
        }) => ({
          stats: {
            // Trainee's persisted best is deliberately dropped rather than merged.
            // It no longer records one, but players from before that change still
            // have a value on disk, and loading it would keep firing the
            // personal-best celebration on the first hit of a practice run.
            trainee: context.stats.trainee,
            accuracy: { ...context.stats.accuracy, ...event.stats.accuracy },
            speed: { ...context.stats.speed, ...event.stats.speed },
          },
        }),
      ),
    },
  },
  states: {
    menu: {
      on: {
        START: {
          target: 'playing',
          actions: assign(({ context }: { context: Context }) =>
            freshGame(context.mode, context.hitBatch.seq),
          ),
        },
        SET_MODE: {
          actions: assign(
            ({ event }: { event: Extract<Event, { type: 'SET_MODE' }> }) => ({
              mode: event.mode,
            }),
          ),
        },
        SET_DIFFICULTY: {
          actions: assign(
            ({ event }: { event: Extract<Event, { type: 'SET_DIFFICULTY' }> }) => ({
              difficulty: event.difficulty,
            }),
          ),
        },
      },
    },
    playing: {
      on: {
        PAUSE: { target: 'paused' },
        PRESS: [
          {
            guard: ({
              context,
              event,
            }: {
              context: Context
              event: Extract<Event, { type: 'PRESS' }>
            }) =>
              applyGrid(
                context,
                buildPressGrid(context.grid, event.index, event.delta),
                event.now,
              ).lives <= 0,
            target: 'gameOver',
            actions: assign(
              ({
                context,
                event,
              }: {
                context: Context
                event: Extract<Event, { type: 'PRESS' }>
              }) =>
                applyGrid(
                  context,
                  buildPressGrid(context.grid, event.index, event.delta),
                  event.now,
                ),
            ),
          },
          {
            actions: assign(
              ({
                context,
                event,
              }: {
                context: Context
                event: Extract<Event, { type: 'PRESS' }>
              }) =>
                applyGrid(
                  context,
                  buildPressGrid(context.grid, event.index, event.delta),
                  event.now,
                ),
            ),
          },
        ],
        // Absolute set (swipe left → 0, swipe right → 9).
        SET_CELL: [
          {
            guard: ({
              context,
              event,
            }: {
              context: Context
              event: Extract<Event, { type: 'SET_CELL' }>
            }) =>
              applyGrid(
                context,
                buildSetGrid(context.grid, event.index, event.value),
                event.now,
              ).lives <= 0,
            target: 'gameOver',
            actions: assign(
              ({
                context,
                event,
              }: {
                context: Context
                event: Extract<Event, { type: 'SET_CELL' }>
              }) =>
                applyGrid(
                  context,
                  buildSetGrid(context.grid, event.index, event.value),
                  event.now,
                ),
            ),
          },
          {
            actions: assign(
              ({
                context,
                event,
              }: {
                context: Context
                event: Extract<Event, { type: 'SET_CELL' }>
              }) =>
                applyGrid(
                  context,
                  buildSetGrid(context.grid, event.index, event.value),
                  event.now,
                ),
            ),
          },
        ],
        TARGET_EXPIRED: [
          {
            // No-life-loss modes (trainee): just clear the target, keep playing.
            guard: ({ context }: { context: Context }) =>
              MODES[context.mode].lives === Number.POSITIVE_INFINITY,
            actions: assign(
              ({
                context,
                event,
              }: {
                context: Context
                event: Extract<Event, { type: 'TARGET_EXPIRED' }>
              }) => ({
                targets: context.targets.filter((t) => t.id !== event.id),
                streak: 0,
              }),
            ),
          },
          {
            guard: ({ context }: { context: Context }) => context.lives <= 1,
            target: 'gameOver',
            actions: assign(
              ({
                context,
                event,
              }: {
                context: Context
                event: Extract<Event, { type: 'TARGET_EXPIRED' }>
              }) => ({
                targets: context.targets.filter((t) => t.id !== event.id),
                lives: 0,
                streak: 0,
              }),
            ),
          },
          {
            actions: assign(
              ({
                context,
                event,
              }: {
                context: Context
                event: Extract<Event, { type: 'TARGET_EXPIRED' }>
              }) => ({
                targets: context.targets.filter((t) => t.id !== event.id),
                lives: context.lives - 1,
                streak: 0,
              }),
            ),
          },
        ],
        ADD_TARGET: {
          guard: ({ context }: { context: Context }) =>
            context.targets.length < DIFFICULTIES[context.difficulty].maxTargets,
          actions: assign(
            ({
              context,
              event,
            }: {
              context: Context
              event: Extract<Event, { type: 'ADD_TARGET' }>
            }) => ({
              targets: [
                ...context.targets,
                {
                  id: context.nextTargetId,
                  value: event.value,
                  spawnedAt: event.at,
                  duration: rampedTimeout(context.mode, context.difficulty, context.hits),
                  refAt: event.at,
                  refGrid: context.grid,
                  par: computePar(context.grid, event.value),
                  userSteps: 0,
                },
              ],
              nextTargetId: context.nextTargetId + 1,
            }),
          ),
        },
      },
    },
    paused: {
      on: {
        RESUME: { target: 'playing' },
        // "New game" from the pause/settings menu returns to the intro menu.
        MENU: { target: 'menu' },
        // TARGET_EXPIRED is deliberately not handled here. A paused run has no clock
        // running — every countdown is frozen where it stood — so nothing can time out
        // while paused, and an expiry that arrives anyway is one that was already in
        // flight when the pause landed. Quietly dropping the target, as this state used
        // to, is what let a player pause a target away: it vanished and cost nothing.
        // Ignored, it keeps its sliver of clock and runs out on resume, where it counts.
      },
    },
    gameOver: {
      on: {
        MENU: { target: 'menu' },
        SET_MODE: {
          actions: assign(
            ({ event }: { event: Extract<Event, { type: 'SET_MODE' }> }) => ({
              mode: event.mode,
            }),
          ),
        },
        SET_DIFFICULTY: {
          actions: assign(
            ({ event }: { event: Extract<Event, { type: 'SET_DIFFICULTY' }> }) => ({
              difficulty: event.difficulty,
            }),
          ),
        },
        RESTART: {
          target: 'playing',
          actions: assign(({ context }: { context: Context }) =>
            freshGame(context.mode, context.hitBatch.seq),
          ),
        },
      },
    },
  },
})
