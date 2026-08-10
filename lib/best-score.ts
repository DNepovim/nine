// A best score is only worth putting on screen when it actually exists. Null means
// the board is empty or the request failed; zero means the player has never scored
// on this board. Both render as nothing at all — no dashes, no zero, no error.
export const hasBestScore = (value: number | null): value is number =>
  value !== null && value > 0
