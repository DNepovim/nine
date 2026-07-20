import { MAX_TARGET } from '@/constants/game'

// Maps a numeric value to its tint progress (0 → 1) across the 0..MAX_TARGET range.
export const valueProgress = (value: number): number =>
  Math.min(1, Math.max(0, value / MAX_TARGET))
