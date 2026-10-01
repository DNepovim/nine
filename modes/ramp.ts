// What tightens as a run goes on, and the one curve everything that tightens uses.

// Where a mode's difficulty ramp lands. `clock` shortens the ring each target gets,
// `spawn` shortens the gap between arrivals, `none` holds the run at one pace.
//
// One or the other, never both. Speed squeezes the clock, and its spawn gap follows the
// clock so the board stays about as full. Accuracy's clock has to stay where it is —
// deliberation is the thing it asks for, and hurrying it would undo that — so its run
// tightens by targets arriving closer together instead.
export type RampTarget = 'clock' | 'spawn' | 'none'

// How many hits close half the remaining gap to the floor, and how far down that
// floor sits relative to the run's starting timeout.
//
// Shared by everything that ramps — Speed's clock, Accuracy's spawn gap, arcade's
// crossroad clock — so tuning one tunes them all, and they stay tightening at the same
// felt rate.
const RAMP_HALF_LIFE_HITS = 12
const RAMP_FLOOR_RATIO = 0.55

// The ramp itself, shared by everything that tightens — including arcade, which counts
// crossroads where Speed counts hits and is exported to for exactly that. A second copy
// of the decay would be a second thing to tune.
//
// Exponential decay towards a floor: each RAMP_HALF_LIFE_HITS hits removes half of
// whatever slack is left. That makes the contraction decelerate — the first stretch
// of hits costs far more than the next equal stretch, and the curve never reaches
// the floor at all, so a run tightens without ever becoming impossible.
export const decayed = (base: number, hits: number): number => {
  const floor = base * RAMP_FLOOR_RATIO
  const remaining = 0.5 ** (Math.max(0, hits) / RAMP_HALF_LIFE_HITS)
  return floor + (base - floor) * remaining
}
