import type { GameState } from "../store/Game";

export const gameSum = (state: GameState): number => {
  return state.numbers.reduce(
    (sum: number, row: number[], rowIndex: number) => {
      return (
        sum +
        row.reduce(
          (rowSum: number, number: number, colIndex: number) =>
            rowSum + number * (colIndex + 1) * (rowIndex + 1),
          0
        )
      );
    },
    0
  );
};
