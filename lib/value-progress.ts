// Maps a numeric value to its tint progress (0 → 1) across the range the board reaches.
export const valueProgress = (value: number, maxSum: number): number =>
  maxSum <= 0 ? 0 : Math.min(1, Math.max(0, value / maxSum))
