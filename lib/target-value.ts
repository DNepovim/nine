import type { DialSpec } from '@/modes'

// Which values a spawning target may take. The whole range the dial reaches in most
// modes; a mode that sets a `reach` narrows it to a stretch either side of the number
// just hit.
export type TargetRange = { min: number; max: number }

// Everything the dial can be dialled to.
export const fullRange = (dial: DialSpec): TargetRange => ({
  min: 0,
  max: dial.maxSum,
})

// A range `reach` either side of a value, clipped to the range targets live in. Clipped
// rather than shifted: a range around 20 is shorter on the low side because there is
// nothing down there, and sliding it up to keep its length would quietly stop obeying
// the reach it was asked for.
export const rangeAround = (
  dial: DialSpec,
  value: number,
  reach: number,
): TargetRange => ({
  min: Math.max(0, value - reach),
  max: Math.min(dial.maxSum, value + reach),
})

// The value a spawning target gets: the roll's own pick, or the nearest free number to
// it inside the range.
//
// `taken` is what the board would not survive being handed — the sum currently dialled,
// which would be hit the instant it appeared, and every value already standing. The walk
// outward is what keeps a full range from being the spawner's problem: it steps up
// first and then down, one unit at a time, and only gives the roll's own pick back if
// every number in the range is spoken for.
export function pickTargetValue({
  roll,
  taken,
  range,
}: {
  // A fraction in [0, 1) — `Math.random()` at the call site, a fixed number in a test.
  roll: number
  taken: readonly number[]
  range: TargetRange
}): number {
  const span = range.max - range.min + 1
  // Clamped against a roll of exactly 1, which `Math.random` never returns and a caller
  // might.
  const first = range.min + Math.min(span - 1, Math.floor(roll * span))
  const blocked = new Set(taken)
  if (!blocked.has(first)) return first
  for (let step = 1; step < span; step++) {
    const up = first + step
    if (up <= range.max && !blocked.has(up)) return up
    const down = first - step
    if (down >= range.min && !blocked.has(down)) return down
  }
  return first
}
