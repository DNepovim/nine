import type { TargetRange } from '@/lib/target-value'
import type { DialSpec } from '@/modes'

// Which way a target's number **drifts**: up, down, or not at all. `0` is a target that
// holds still — every target on a mode with no drift — and the one spelling of it.
export type Drift = -1 | 0 | 1
// A way a drifting target actually goes.
export type Heading = Exclude<Drift, 0>
// What reading a drifting number needs of a target.
type Drifting = { value: number; drift: Drift; spawnedAt: number }

// A **drifting** target's number: the value it arrived as, moved one step in its own
// direction for every whole step it has stood. Under its first step it is the value it
// arrived as, which is what a `fresh` hit catches.
//
// One function, read by everything that means "the number now" — the machine's hit, the
// card's digits, the values the spawner keeps clear of — so a press and the card it was
// aimed at can never disagree about which number is on the board. What a target arrived
// as stays `value`: par, a drill's order and a saved run all mean that one.
//
// The age is `now − spawnedAt`, which already leaves out time spent paused — RESUME and a
// restore both move `spawnedAt` on by it — so the drift stops when the ring does without
// being told.
export function driftedValue(target: Drifting, now: number, step: number | null): number {
  if (step === null || target.drift === 0) return target.value
  const steps = Math.floor(Math.max(0, now - target.spawnedAt) / step)
  return target.value + target.drift * steps
}

// Whether a target was caught before its number moved: under its first step. False for a
// target that does not drift at all — on a mode with no drift, and for a target dealt
// still on a mode that has one — since a number that was never going to move cannot be
// caught before it does.
export const isFresh = (
  target: Pick<Drifting, 'spawnedAt' | 'drift'>,
  now: number,
  step: number | null,
): boolean => step !== null && target.drift !== 0 && now - target.spawnedAt < step

// The values a drifting target may arrive as, so that it never leaves the dial before
// its ring runs out: a rising one at least as many steps below the top as its ring can
// hold, a falling one as many above nought.
//
// Counted up rather than down — `ceil` — so a ring that ends between two steps keeps the
// room for the step it would never quite take. One number tighter than it strictly need
// be, on the side where nothing can go wrong.
export function driftRange(
  dial: DialSpec,
  drift: Heading,
  durationMs: number,
  step: number,
): TargetRange {
  const room = Math.min(dial.maxSum, Math.ceil(durationMs / step))
  return drift === 1
    ? { min: 0, max: dial.maxSum - room }
    : { min: room, max: dial.maxSum }
}

// How long until a drifting target's number next moves, in ms: what is left of the step it
// is on, plus one, so whoever wakes then reads the new number rather than the last instant
// of the old one.
export function msToNextStep(
  target: Pick<Drifting, 'spawnedAt'>,
  now: number,
  step: number,
): number {
  const age = Math.max(0, now - target.spawnedAt)
  return step - (age % step) + 1
}

// Every value a target heading `drift` could arrive as and still pass through `sum` before
// its ring runs out — the numbers that would drift onto a sum standing on the dial and be
// taken there with nobody touching a key. The spawner keeps clear of them: aiming ahead is
// the player's move to make, not a gift a parked dial collects.
export function driftPath(
  sum: number,
  drift: Heading,
  durationMs: number,
  step: number,
): number[] {
  const steps = Math.ceil(durationMs / step)
  return Array.from({ length: steps + 1 }, (_, k) => sum - drift * k)
}
