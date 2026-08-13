import type { Target } from '@/machines/game'

export type Position = { x: number; y: number }

// A machine target augmented with its on-screen placement and exit-animation flag.
export type DisplayTarget = Target & { exiting: boolean; position: Position }

// Which hundred a target's value falls in — 0 for 0–99 through 3 for 300+. MAX_TARGET
// is 324, so these four cover the range. The countdown pie tints its track by band so
// the hundreds digit reads without being parsed: 223 cannot pass for 123.
export type TargetBand = 0 | 1 | 2 | 3
