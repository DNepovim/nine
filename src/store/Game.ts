import { create } from "zustand";

export interface GameState {
  numbers: number[][];
  score: number;
  lives: number;
  increaseNumber: (row: number, col: number) => void;
  decreaseNumber: (row: number, col: number) => void;
  increaseScore: (points: number) => void;
  decreaseLives: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  numbers: [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ],
  score: 0,
  lives: 3,
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
    set((state) => ({
      lives: state.lives - 1,
    })),
}));
