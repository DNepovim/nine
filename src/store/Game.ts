import { create } from "zustand";
import { persist } from "zustand/middleware";
import { gameSum, maxSum } from "../utils/gameSum";
import { immer } from "zustand/middleware/immer";
import { createNewTarget } from "./utils";

export type GameScreen = "start" | "game" | "over";

// todo: inital target has wrong timestamp

export const TARGETS_CREATION_INTERVAL = 2;

export interface Target {
  value: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  createdTime: number;
  position: { x: number; y: number };
}

const initialNumbers = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
];

const initialState = {
  numbers: initialNumbers,
  sum: gameSum(initialNumbers),
  score: 0,
  lives: 3,
  screen: "start" as GameScreen,
  bestScore: 0,
  targets: [] as Target[],
  gameTime: 0,
  startTime: 0,
  isGameRunning: false,
  lastTargetCreationTime: 0,
  containerWidth: 0,
  containerHeight: 0,
};

export interface GameState {
  numbers: number[][];
  sum: number;
  score: number;
  lives: number;
  screen: GameScreen;
  bestScore: number;
  targets: Target[];
  gameTime: number;
  startTime: number;
  isGameRunning: boolean;
  lastTargetCreationTime: number;
  containerWidth: number;
  containerHeight: number;
  updateNumber: (
    row: number,
    col: number,
    action: "increase" | "decrease"
  ) => void;
  startGame: (time: number, width: number, height: number) => void;
  updateGame: (time: number) => void;
  setScreen: (screen: GameScreen) => void;
  resetGame: () => void;
}

const increaseNumber = (num: number) => (num === 9 ? 0 : num + 1);
const decreaseNumber = (num: number) => (num === 0 ? 9 : num - 1);

export const useGameStore = create<GameState>()(
  persist(
    immer((set) => ({
      ...initialState,
      updateNumber: (row, col, action) =>
        set((state) => {
          const currentValue = state.numbers[row][col];
          const newValue =
            action === "increase"
              ? increaseNumber(currentValue)
              : decreaseNumber(currentValue);

          state.numbers[row][col] = newValue;
          state.sum = gameSum(state.numbers);
        }),
      startGame: (time, width, height) =>
        set((state) => {
          state.startTime = time;
          state.containerWidth = width;
          state.containerHeight = height;
          state.targets = [
            createNewTarget(state, { min: maxSum * 0.25, max: maxSum * 0.75 }),
          ];
          state.isGameRunning = true;
        }),
      updateGame: (time) =>
        set((state) => {
          state.gameTime = time;
          if (state.targets.length === 0) {
            state.targets.push(createNewTarget(state));
          }

          state.targets.forEach((target, index) => {
            if (target.value === state.sum) {
              state.targets.splice(index, 1);
              state.score++;
              return;
            }

            if (time - target.createdTime > TARGETS_CREATION_INTERVAL) {
              state.targets.splice(index, 1);
              state.lives--;
              return;
            }
          });

          if (state.lives < 1) {
            state.screen = "over";
          }
        }),
      setScreen: (screen) =>
        set((state) => {
          state.isGameRunning = false;
          state.screen = screen;
        }),
      resetGame: () =>
        set((state) => {
          Object.assign(state, initialState, { screen: "game" });
        }),
    })),
    {
      name: "game-storage",
    }
  )
);
