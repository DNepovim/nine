import { assign, createMachine } from 'xstate';

type Grid = [[number, number, number], [number, number, number], [number, number, number]];
export type Target = { id: number; value: number };

export type Difficulty = 'trainee' | 'easy' | 'medium' | 'hard' | 'extreme';

export const DIFFICULTY_ORDER: Difficulty[] = ['trainee', 'easy', 'medium', 'hard', 'extreme'];

export const DIFFICULTIES: Record<Difficulty, { label: string; duration: number; loseLives: boolean }> = {
  trainee: { label: 'TRAINEE', duration: 20000, loseLives: false },
  easy: { label: 'EASY', duration: 20000, loseLives: true },
  medium: { label: 'MEDIUM', duration: 15000, loseLives: true },
  hard: { label: 'HARD', duration: 10000, loseLives: true },
  extreme: { label: 'EXTREME', duration: 7000, loseLives: true },
};

export type BestScores = Record<Difficulty, number>;

const emptyBestScores = (): BestScores => ({ trainee: 0, easy: 0, medium: 0, hard: 0, extreme: 0 });

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
  gameScore: number;
  bestScores: BestScores;
  difficulty: Difficulty;
  lives: number;
  targets: Target[];
  nextTargetId: number;
};

type Event =
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'RESTART' }
  | { type: 'MENU' }
  | { type: 'SET_DIFFICULTY'; difficulty: Difficulty }
  | { type: 'HYDRATE_BEST'; bestScores: BestScores }
  | { type: 'PRESS'; index: number; delta: 1 | -1 }
  | { type: 'SET_CELL'; index: number; value: number }
  | { type: 'ADD_TARGET'; value: number }
  | { type: 'TARGET_EXPIRED'; id: number };

// Per-game state reset; difficulty and bestScores are intentionally omitted so
// assign leaves them untouched (it merges only the returned keys).
const freshGame = () => ({
  grid: initialGrid,
  gameScore: 0,
  lives: 3,
  targets: [] as Target[],
  nextTargetId: 0,
});

// Applies a new grid: clears any targets matching the new sum, scores the
// matches, and keeps the per-difficulty best score up to date.
function applyGrid(context: Context, newGrid: Grid) {
  const newSum = computeSum(newGrid);
  const matched = context.targets.filter(t => t.value === newSum);
  const gameScore = context.gameScore + matched.length;
  return {
    grid: newGrid,
    targets: context.targets.filter(t => t.value !== newSum),
    gameScore,
    bestScores: {
      ...context.bestScores,
      [context.difficulty]: Math.max(context.bestScores[context.difficulty], gameScore),
    },
  };
}

export const gameMachine = createMachine({
  types: {} as { context: Context; events: Event },
  id: 'game',
  initial: 'menu',
  context: {
    grid: initialGrid as Grid,
    gameScore: 0,
    bestScores: emptyBestScores(),
    difficulty: 'easy' as Difficulty,
    lives: 3,
    targets: [] as Target[],
    nextTargetId: 0,
  } satisfies Context,
  on: {
    // Load persisted best scores from storage on app start.
    HYDRATE_BEST: {
      actions: assign(({ context, event }: { context: Context; event: Extract<Event, { type: 'HYDRATE_BEST' }> }) => ({
        bestScores: { ...context.bestScores, ...event.bestScores },
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
            return applyGrid(context, newGrid);
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
            return applyGrid(context, newGrid);
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
              bestScores: {
                ...context.bestScores,
                [context.difficulty]: Math.max(context.bestScores[context.difficulty], context.gameScore),
              },
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
            targets: [...context.targets, { id: context.nextTargetId, value: event.value }],
            nextTargetId: context.nextTargetId + 1,
          })),
        },
      },
    },
    paused: {
      on: {
        RESUME: { target: 'playing' },
        // "New game" from the pause/settings menu returns to the intro menu,
        // where difficulty can be chosen before starting a fresh game.
        MENU: { target: 'menu' },
        // Timers that fire while paused just remove the target — no life lost
        TARGET_EXPIRED: {
          actions: assign(({ context, event }: { context: Context; event: Extract<Event, { type: 'TARGET_EXPIRED' }> }) => ({
            targets: context.targets.filter(t => t.id !== event.id),
          })),
        },
      },
    },
    gameOver: {
      on: {
        // "New game" returns to the intro menu (choose difficulty, then play).
        MENU: { target: 'menu' },
        RESTART: {
          target: 'playing',
          actions: assign((_args: { context: Context; event: Extract<Event, { type: 'RESTART' }> }) => freshGame()),
        },
      },
    },
  },
});
