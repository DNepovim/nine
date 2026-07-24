import { isNonEmptyArray } from 'narrowland'
import { assign, createMachine } from 'xstate'

import {
  DIFFICULTIES,
  effectiveTimeout,
  MODES,
  streakMultiplier,
  type Difficulty,
  type Mode,
} from './modes'
import { accuracyFactor, computeHitPoints, computePar, speedFactor } from './scoring'

export type { Difficulty, Mode } from './modes'
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

// Per-game reset; mode, difficulty, stats and hitBatch are intentionally omitted so
// assign leaves them untouched (hitBatch.seq stays monotonic across games).
const freshGame = (mode: Mode) => ({
  grid: initialGrid,
  hits: 0,
  score: 0,
  lives: MODES[mode].lives,
  streak: 0,
  accSum: 0,
  spdSum: 0,
  targets: [] as Target[],
  nextTargetId: 0,
})

const bestByScore = (
  prev: DifficultyStats,
  score: number,
  hits: number,
  accSum: number,
  spdSum: number,
): DifficultyStats => (score > prev.score ? { score, hits, accSum, spdSum } : prev)

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
  const duration = effectiveTimeout(context.mode, context.difficulty)

  let rawScore = 0
  let allOptimal = isNonEmptyArray(matched)
  let accAdded = 0
  let spdAdded = 0
  const perTarget: {
    points: number
    progress: number
    accFactor: number
    spdFactor: number
  }[] = []

  for (const t of matched) {
    const userSteps = t.userSteps + 1
    const timeLeft = Math.max(0, duration - (now - t.spawnedAt))
    const progress = duration > 0 ? Math.min(1, Math.max(0, timeLeft / duration)) : 0
    const pts = computeHitPoints({
      par: t.par,
      userSteps,
      timeLeft,
      duration,
      weights: mode.weights,
    })
    const acc = accuracyFactor(t.par, userSteps)
    const spd = speedFactor(timeLeft, duration)
    if (userSteps !== t.par) allOptimal = false
    accAdded += acc
    spdAdded += spd
    rawScore += pts
    perTarget.push({ points: pts, progress, accFactor: acc, spdFactor: spd })
  }

  const triggered =
    mode.streak === 'optimal'
      ? anyHit && allOptimal
      : mode.streak === 'clear'
        ? clearedBoard
        : false
  let streak = context.streak
  let multiplier = 1
  if (mode.streak === 'none') {
    multiplier = clearedBoard ? 2 : 1 // legacy trainee behavior
  } else if (triggered) {
    streak = context.streak + 1
    multiplier = streakMultiplier(streak)
  } else if (mode.streak === 'optimal' && anyHit) {
    streak = 0 // a matching but non-optimal hit resets accuracy streak
  } // speed non-clearing hit, or any miss: streak unchanged, multiplier stays 1

  const addedScore = Math.round(rawScore * multiplier)
  const hitInfos: HitInfo[] = perTarget.map((p) => ({
    points: Math.round(p.points * multiplier),
    progress: p.progress,
    bonus: multiplier > 1,
    multiplier,
    accFactor: p.accFactor,
    spdFactor: p.spdFactor,
  }))

  const hits = context.hits + matched.length
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

  const stats = anyHit
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

  return {
    grid: newGrid,
    targets,
    hits,
    score,
    streak,
    accSum: newAccSum,
    spdSum: newSpdSum,
    stats,
    hitBatch,
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
            trainee: { ...context.stats.trainee, ...event.stats.trainee },
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
          actions: assign(({ context }: { context: Context }) => freshGame(context.mode)),
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
        PRESS: {
          actions: assign(
            ({
              context,
              event,
            }: {
              context: Context
              event: Extract<Event, { type: 'PRESS' }>
            }) => {
              const row = Math.floor(event.index / 3)
              const col = event.index % 3
              const newGrid = context.grid.map((r, ri) =>
                r.map((v, ci) => {
                  if (ri !== row || ci !== col) return v
                  return (((v + event.delta) % 10) + 10) % 10
                }),
              ) as Grid
              return applyGrid(context, newGrid, event.now)
            },
          ),
        },
        // Absolute set (swipe left → 0, swipe right → 9).
        SET_CELL: {
          actions: assign(
            ({
              context,
              event,
            }: {
              context: Context
              event: Extract<Event, { type: 'SET_CELL' }>
            }) => {
              const row = Math.floor(event.index / 3)
              const col = event.index % 3
              const newGrid = context.grid.map((r, ri) =>
                r.map((v, ci) => (ri === row && ci === col ? event.value : v)),
              ) as Grid
              return applyGrid(context, newGrid, event.now)
            },
          ),
        },
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
        // Timers that fire while paused just remove the target — no life lost.
        TARGET_EXPIRED: {
          actions: assign(
            ({
              context,
              event,
            }: {
              context: Context
              event: Extract<Event, { type: 'TARGET_EXPIRED' }>
            }) => ({
              targets: context.targets.filter((t) => t.id !== event.id),
            }),
          ),
        },
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
          actions: assign(({ context }: { context: Context }) => freshGame(context.mode)),
        },
      },
    },
  },
})
