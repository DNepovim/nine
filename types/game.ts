import type { Target } from '@/machines/game'

export type Position = { x: number; y: number }

// How a target left the board, and so which exit it plays. `failed` covers both ways
// a target can be lost — running out of clock, and being dialled so wastefully in
// Accuracy that it costs a life — because to the player they are the same event.
export type TargetExit = 'hit' | 'failed'

// A machine target augmented with its on-screen placement and the exit it is playing,
// `null` while it is still live.
export type DisplayTarget = Target & { exit: TargetExit | null; position: Position }

// Which hundred a target's value falls in — 0 for 0–99 through 3 for 300+. MAX_TARGET
// is 324, so these four cover the range. The countdown pie tints its track by band so
// the hundreds digit reads without being parsed: 223 cannot pass for 123.
export type TargetBand = 0 | 1 | 2 | 3
