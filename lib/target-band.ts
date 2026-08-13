import { MAX_TARGET } from '@/constants/game'
import type { TargetBand } from '@/types/game'

const BANDS = [0, 1, 2, 3] as const satisfies readonly TargetBand[]

// The hundreds digit of a target value. Values are clamped into 0..MAX_TARGET first,
// so the lookup always lands on a real band.
export const targetBand = (value: number): TargetBand => {
  const clamped = Math.min(MAX_TARGET, Math.max(0, value))
  return BANDS[Math.floor(clamped / 100)] ?? 0
}
