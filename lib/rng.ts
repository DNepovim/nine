// Deterministic randomness, for the two things in the app that need the same answer twice.
//
// An arcade run is a seed and nothing else: the same seed walks the same map, which is
// what makes a bug report reproducible and a test possible. A **recap** needs it for a
// different reason — the paragraph is seeded on the week it describes, so a player who
// dismisses the dialog and opens it again is told the week in the same words. Both want
// one generator, and this is it.
//
// Lived in machines/arcade.ts until the recap arrived. Moved rather than copied: a second
// generator would have been a second answer to "what does seed 42 give", and the maps
// already grown under this one have to keep growing the same way.

// A run's own source of randomness.
export type Rng = () => number

export function seeded(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

// A string as a number — FNV-1a over its characters.
//
// Three things need one. The arcade map needs a crossroad's randomness to depend on
// *which* crossroad it is rather than on how many were grown before it, so that growing
// one twice gives the same answer and React may call an updater as often as it likes. The
// drawing needs each way to sway on its own phase, which has to be the same phase on every
// render or a fan would jitter instead of breathe. And a recap is seeded on the Monday of
// the week it tells, which is a date string before it is anything else.
export function idSeed(id: string): number {
  let hash = 2166136261
  for (let i = 0; i < id.length; i++) {
    hash = ((hash ^ id.charCodeAt(i)) * 16777619) >>> 0
  }
  return hash
}

// One of a set, chosen by the generator.
//
// Takes a non-empty tuple so there is always something to return — the recap's phrasing
// pools are all written as literal tuples, which is what makes that hold at compile time
// rather than at the call site.
export const pickFrom = <T>(rng: Rng, options: readonly [T, ...T[]]): T =>
  options[Math.floor(rng() * options.length)] ?? options[0]
