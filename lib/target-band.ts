import type { TargetBand } from '@/types/game'

const BANDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const satisfies readonly TargetBand[]

// The hundreds digit of a target value. Values are clamped into the range the board
// reaches first, so the lookup always lands on a real band — and a board whose ceiling
// is under 400 simply never reaches the upper ones.
//
// The list ran to 3 while every dial in the app stopped at 324, and the `?? 0` below is
// what that cost: a target of 457 on the four-by-four challenge asked for a band nobody
// had written, got nothing back, and was drawn in band 0's untinted track — which is the
// app's signal for *under a hundred*. The highest numbers on the widest dial read as the
// smallest. One entry per hundred the widest dial reaches, and the fallback goes back to
// being unreachable.
export const targetBand = (value: number, maxSum: number): TargetBand => {
  const clamped = Math.min(maxSum, Math.max(0, value))
  return BANDS[Math.floor(clamped / 100)] ?? 0
}
