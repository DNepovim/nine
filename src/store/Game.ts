import { create } from "zustand";
import { persist } from "zustand/middleware";

export type GameScreen = "start" | "game" | "over";

export interface GameState {
  numbers: number[][];
  score: number;
  lives: number;
  screen: GameScreen;
  bestScore: number;
  increaseNumber: (row: number, col: number) => void;
  decreaseNumber: (row: number, col: number) => void;
  increaseScore: (points: number) => void;
  decreaseLives: () => void;
  setScreen: (screen: GameScreen) => void;
  resetGame: () => void;
  setBestScore: (score: number) => void;
}

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      numbers: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ],
      score: 0,
      lives: 3,
      screen: "start",
      bestScore: 0,
      increaseNumber: (row: number, col: number) =>
        set((state) => ({
          numbers: state.numbers.map((r, rowIndex) =>
            rowIndex === row
              ? r.map((num, colIndex) =>
                  colIndex === col ? (num === 9 ? 0 : num + 1) : num
                )
              : r
          ),
        })),
      decreaseNumber: (row: number, col: number) =>
        set((state) => ({
          numbers: state.numbers.map((r, rowIndex) =>
            rowIndex === row
              ? r.map((num, colIndex) =>
                  colIndex === col ? (num === 0 ? 9 : num - 1) : num
                )
              : r
          ),
        })),
      increaseScore: (points: number) =>
        set((state) => ({
          score: state.score + points,
        })),
      decreaseLives: () =>
        set((state) => {
          const newLives = state.lives - 1;
          if (newLives < 1) {
            state.setScreen("over");
            return {};
          }

          return {
            lives: newLives,
          };
        }),
      setScreen: (screen: GameScreen) =>
        set((state) => {
          if (screen === "over" && state.score > state.bestScore) {
            console.log(state.score, state.bestScore);
            return { screen, bestScore: state.score };
          }
          return { screen };
        }),
      resetGame: () =>
        set({
          numbers: [
            [1, 2, 3],
            [4, 5, 6],
            [7, 8, 9],
          ],
          score: 0,
          lives: 3,
          screen: "game",
        }),
      setBestScore: (score: number) => set({ bestScore: score }),
    }),
    {
      name: "game-storage",
    }
  )
);
