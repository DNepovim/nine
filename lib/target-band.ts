import type { TargetBand } from '@/types/game'

const BANDS = [0, 1, 2, 3] as const satisfies readonly TargetBand[]

// The hundreds digit of a target value. Values are clamped into the range the board
// reaches first, so the lookup always lands on a real band — and a board whose ceiling
// is under 400 simply never reaches the upper ones.
export const targetBand = (value: number, maxSum: number): TargetBand => {
  const clamped = Math.min(maxSum, Math.max(0, value))
  return BANDS[Math.floor(clamped / 100)] ?? 0
}
