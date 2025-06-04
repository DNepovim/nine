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

const hexToRgb = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
};

const rgbToHex = (r: number, g: number, b: number) => {
  return `#${Math.round(r).toString(16).padStart(2, "0")}${Math.round(g)
    .toString(16)
    .padStart(2, "0")}${Math.round(b).toString(16).padStart(2, "0")}`;
};

export const colorInterpolation = (
  value: number,
  startColor: string,
  endColor: string
) => {
  const start = hexToRgb(startColor);
  const end = hexToRgb(endColor);
  const progress = value / 9;

  const r = start.r + (end.r - start.r) * progress;
  const g = start.g + (end.g - start.g) * progress;
  const b = start.b + (end.b - start.b) * progress;

  return rgbToHex(r, g, b);
};
