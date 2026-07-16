import { assign, createMachine } from 'xstate';
import { computeHitPoints, computePar } from './scoring';

export type Grid = [[number, number, number], [number, number, number], [number, number, number]];

export type Target = {
  id: number;
  value: number;
  spawnedAt: number; // ms timestamp — drives the countdown / speed factor
  refAt: number; // reference moment (spawn, or the last time any target was hit)
  refGrid: Grid; // dial snapshot at the reference moment
  par: number; // optimal steps from refGrid to value (fixed at reference time)
  userSteps: number; // button changes since the reference moment
};

export type Difficulty = 'trainee' | 'easy' | 'medium' | 'hard' | 'extreme';

export const DIFFICULTY_ORDER: Difficulty[] = ['trainee', 'easy', 'medium', 'hard', 'extreme'];

export const DIFFICULTIES: Record<Difficulty, { label: string; duration: number; loseLives: boolean }> = {
  trainee: { label: 'TRAINEE', duration: 20000, loseLives: false },
  easy: { label: 'EASY', duration: 20000, loseLives: true },
  medium: { label: 'MEDIUM', duration: 15000, loseLives: true },
  hard: { label: 'HARD', duration: 10000, loseLives: true },
  extreme: { label: 'EXTREME', duration: 7000, loseLives: true },
};

export type DifficultyStats = { score: number; hits: number };
export type Stats = Record<Difficulty, DifficultyStats>;

const emptyStats = (): Stats => ({
  trainee: { score: 0, hits: 0 },
  easy: { score: 0, hits: 0 },
  medium: { score: 0, hits: 0 },
  hard: { score: 0, hits: 0 },
  extreme: { score: 0, hits: 0 },
});

// One hit's worth of feedback for the UI's floating "+points" animation.
export type HitInfo = { points: number; progress: number; bonus: boolean };
type HitBatch = { seq: number; hits: HitInfo[] };

export function computeSum(grid: Grid): number {
  return grid.reduce((sum, row, r) =>
    sum + row.reduce((s, val, c) => s + val * (r + 1) * (c + 1), 0), 0);
}

const initialGrid: Grid = [
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
];

type Context = {
  grid: Grid;
  hits: number;
  score: number;
  stats: Stats; // best { score, hits } per difficulty (best by score)
  difficulty: Difficulty;
  lives: number;
  targets: Target[];
  nextTargetId: number;
  hitBatch: HitBatch;
};

type Event =
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'RESTART' }
  | { type: 'MENU' }
  | { type: 'SET_DIFFICULTY'; difficulty: Difficulty }
  | { type: 'HYDRATE_STATS'; stats: Partial<Stats> }
  | { type: 'PRESS'; index: number; delta: 1 | -1; now: number }
  | { type: 'SET_CELL'; index: number; value: number; now: number }
  | { type: 'ADD_TARGET'; value: number; at: number }
  | { type: 'TARGET_EXPIRED'; id: number };

// Per-game reset; difficulty, stats and hitBatch are intentionally omitted so
// assign leaves them untouched (hitBatch.seq stays monotonic across games).
const freshGame = () => ({
  grid: initialGrid,
  hits: 0,
  score: 0,
  lives: 3,
  targets: [] as Target[],
  nextTargetId: 0,
});

const bestByScore = (prev: DifficultyStats, score: number, hits: number): DifficultyStats =>
  score > prev.score ? { score, hits } : prev;

// Applies a new grid: scores any targets whose value equals the new sum, resets
// the reference for surviving targets when a hit happened, doubles points when
// the board is cleared, and emits a hit batch for the UI.
function applyGrid(context: Context, newGrid: Grid, now: number) {
  const newSum = computeSum(newGrid);
  const matched = context.targets.filter(t => t.value === newSum);
  const remaining = context.targets.filter(t => t.value !== newSum);
  const anyHit = matched.length > 0;
  const clearedBoard = anyHit && remaining.length === 0;
  const duration = DIFFICULTIES[context.difficulty].duration;

  let addedScore = 0;
  const hitInfos: HitInfo[] = [];
  for (const t of matched) {
    const userSteps = t.userSteps + 1; // the press that completed the match counts
    const timeLeft = Math.max(0, duration - (now - t.spawnedAt));
    let pts = computeHitPoints({ par: t.par, userSteps, timeLeft, duration });
    if (clearedBoard) pts *= 2;
    addedScore += pts;
    hitInfos.push({
      points: pts,
      progress: duration > 0 ? Math.min(1, Math.max(0, timeLeft / duration)) : 0,
      bonus: clearedBoard,
    });
  }

  const hits = context.hits + matched.length;
  const score = context.score + addedScore;

  // Surviving targets: a hit resets their reference (and par) to now; otherwise
  // this press is just one more step toward them.
  const targets = remaining.map(t =>
    anyHit
      ? { ...t, refAt: now, refGrid: newGrid, par: computePar(newGrid, t.value), userSteps: 0 }
      : { ...t, userSteps: t.userSteps + 1 },
  );

  const stats = anyHit
    ? { ...context.stats, [context.difficulty]: bestByScore(context.stats[context.difficulty], score, hits) }
    : context.stats;

  const hitBatch = anyHit ? { seq: context.hitBatch.seq + 1, hits: hitInfos } : context.hitBatch;

  return { grid: newGrid, targets, hits, score, stats, hitBatch };
}

export const gameMachine = createMachine({
  types: {} as { context: Context; events: Event },
  id: 'game',
  initial: 'menu',
  context: {
    grid: initialGrid as Grid,
    hits: 0,
    score: 0,
    stats: emptyStats(),
    difficulty: 'easy' as Difficulty,
    lives: 3,
    targets: [] as Target[],
    nextTargetId: 0,
    hitBatch: { seq: 0, hits: [] },
  } satisfies Context,
  on: {
    // Load persisted per-difficulty stats on app start.
    HYDRATE_STATS: {
      actions: assign(({ context, event }: { context: Context; event: Extract<Event, { type: 'HYDRATE_STATS' }> }) => ({
        stats: { ...context.stats, ...event.stats },
      })),
    },
  },
  states: {
    menu: {
      on: {
        START: {
          target: 'playing',
          actions: assign((_args: { context: Context; event: Extract<Event, { type: 'START' }> }) => freshGame()),
        },
        SET_DIFFICULTY: {
          actions: assign(({ event }: { event: Extract<Event, { type: 'SET_DIFFICULTY' }> }) => ({
            difficulty: event.difficulty,
          })),
        },
      },
    },
    playing: {
      on: {
        PAUSE: { target: 'paused' },
        PRESS: {
          actions: assign(({ context, event }: { context: Context; event: Extract<Event, { type: 'PRESS' }> }) => {
            const row = Math.floor(event.index / 3);
            const col = event.index % 3;
            const newGrid = context.grid.map((r, ri) =>
              r.map((v, ci) => {
                if (ri !== row || ci !== col) return v;
                return ((v + event.delta) % 10 + 10) % 10;
              })
            ) as Grid;
            return applyGrid(context, newGrid, event.now);
          }),
        },
        // Absolute set (swipe left → 0, swipe right → 9).
        SET_CELL: {
          actions: assign(({ context, event }: { context: Context; event: Extract<Event, { type: 'SET_CELL' }> }) => {
            const row = Math.floor(event.index / 3);
            const col = event.index % 3;
            const newGrid = context.grid.map((r, ri) =>
              r.map((v, ci) => (ri === row && ci === col ? event.value : v))
            ) as Grid;
            return applyGrid(context, newGrid, event.now);
          }),
        },
        TARGET_EXPIRED: [
          {
            // No-life-loss difficulties (trainee): just clear the target, keep playing.
            guard: ({ context }: { context: Context }) => !DIFFICULTIES[context.difficulty].loseLives,
            actions: assign(({ context, event }: { context: Context; event: Extract<Event, { type: 'TARGET_EXPIRED' }> }) => ({
              targets: context.targets.filter(t => t.id !== event.id),
            })),
          },
          {
            guard: ({ context }: { context: Context }) => context.lives <= 1,
            target: 'gameOver',
            actions: assign(({ context, event }: { context: Context; event: Extract<Event, { type: 'TARGET_EXPIRED' }> }) => ({
              targets: context.targets.filter(t => t.id !== event.id),
              lives: 0,
            })),
          },
          {
            actions: assign(({ context, event }: { context: Context; event: Extract<Event, { type: 'TARGET_EXPIRED' }> }) => ({
              targets: context.targets.filter(t => t.id !== event.id),
              lives: context.lives - 1,
            })),
          },
        ],
        ADD_TARGET: {
          guard: ({ context }: { context: Context }) => context.targets.length < 5,
          actions: assign(({ context, event }: { context: Context; event: Extract<Event, { type: 'ADD_TARGET' }> }) => ({
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
          })),
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
          actions: assign(({ context, event }: { context: Context; event: Extract<Event, { type: 'TARGET_EXPIRED' }> }) => ({
            targets: context.targets.filter(t => t.id !== event.id),
          })),
        },
      },
    },
    gameOver: {
      on: {
        MENU: { target: 'menu' },
        // The game-over screen reuses the intro layout, so difficulty can be
        // changed here before playing again.
        SET_DIFFICULTY: {
          actions: assign(({ event }: { event: Extract<Event, { type: 'SET_DIFFICULTY' }> }) => ({
            difficulty: event.difficulty,
          })),
        },
        RESTART: {
          target: 'playing',
          actions: assign((_args: { context: Context; event: Extract<Event, { type: 'RESTART' }> }) => freshGame()),
        },
      },
    },
  },
});
