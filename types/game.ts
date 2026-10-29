import type { Target } from '@/machines/game'

export type Position = { x: number; y: number }

// How a target left the board, and so which exit it plays. `failed` covers both ways
// a target can be lost — running out of clock, and being dialled so wastefully in
// Accuracy that it costs a life — because to the player they are the same event.
export type TargetExit = 'hit' | 'failed'

// A machine target augmented with its on-screen placement and the exit it is playing,
// `null` while it is still live. `startProgress` is where its ring begins — a fraction
// of the duration, fixed when the target is placed. Full for anything that spawned
// while the app was open, and less for a target put back from storage mid-clock; see
// lib/target-clock.ts.
export type DisplayTarget = Target & {
  exit: TargetExit | null
  // The number a hit took it at, once it has been taken — what a **drifting** card shows as
  // it leaves, since by then its own clock has stopped and may have stopped a step early.
  takenAt?: number
  position: Position
  startProgress: number
}

// Which hundred a target's value falls in — 0 for 0–99 through 9 for 900. The countdown
// pie tints its track by band so the hundreds digit reads without being parsed: 223
// cannot pass for 123.
//
// Ten rather than the four the nine dial needs. A **dial** decides how high the range
// goes — `maxSum` is 324 on the nine every permanent mode is played on, and 900 on the
// four-by-four challenge — so the bands have to cover the widest dial any mode may hand
// over rather than the one the game grew up on. Below band 4 nothing has changed; those
// are the only bands a 324 board ever reaches.
export type TargetBand = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
