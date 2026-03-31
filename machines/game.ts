import { assign, createMachine } from 'xstate';

type Grid = [[number, number, number], [number, number, number], [number, number, number]];
export type Target = { id: number; value: number };

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
  bestScore: number;
  lives: number;
  targets: Target[];
  nextTargetId: number;
};

type Event =
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'RESTART' }
  | { type: 'PRESS'; index: number; delta: 1 | -1 }
  | { type: 'ADD_TARGET'; value: number }
  | { type: 'TARGET_EXPIRED'; id: number };

const resetGame = assign(({ context }: { context: Context }) => ({
  grid: initialGrid,
  gameScore: 0,
  lives: 3,
  targets: [] as Target[],
  nextTargetId: 0,
  bestScore: context.bestScore,
}));

export const gameMachine = createMachine({
  id: 'game',
  initial: 'menu',
  context: {
    grid: initialGrid as Grid,
    gameScore: 0,
    bestScore: 0,
    lives: 3,
    targets: [] as Target[],
    nextTargetId: 0,
  } satisfies Context,
  states: {
    menu: {
      on: {
        START: { target: 'playing', actions: resetGame },
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
            const newSum = computeSum(newGrid);
            const matched = context.targets.filter(t => t.value === newSum);
            return {
              grid: newGrid,
              targets: context.targets.filter(t => t.value !== newSum),
              gameScore: context.gameScore + matched.length,
            };
          }),
        },
        TARGET_EXPIRED: [
          {
            guard: ({ context }: { context: Context }) => context.lives <= 1,
            target: 'gameOver',
            actions: assign(({ context, event }: { context: Context; event: Extract<Event, { type: 'TARGET_EXPIRED' }> }) => ({
              targets: context.targets.filter(t => t.id !== event.id),
              lives: 0,
              bestScore: Math.max(context.bestScore, context.gameScore),
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
        START: { target: 'playing', actions: resetGame },
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
        RESTART: { target: 'playing', actions: resetGame },
      },
    },
  },
});
