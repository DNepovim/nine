import { maxSum } from "../utils/gameSum";
import type { GameState } from "./Game";

export const createNewTarget = (
  state: GameState,
  options?: { min?: number; max?: number }
) => {
  const min = options?.min ?? 0;
  const max = options?.max ?? maxSum;

  return {
    value: Math.floor(Math.random() * (max - min + 1)) + min,
    createdTime: state.gameTime,
    position: {
      x: Math.random() * (state.containerWidth - 100),
      y: Math.random() * (state.containerHeight - 100),
    },
  };
};
