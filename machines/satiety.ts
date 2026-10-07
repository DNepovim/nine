import { accuracyFactor } from '@/machines/scoring'

// Satiety: how fed the hero is on an arcade run, and what walking costs it.
//
// Pure, like machines/arcade.ts and machines/siege.ts and for the same reason: no pixels,
// no React and no clock. The hook owns the timer that starves the hero; everything about
// what a leg costs and what is left afterwards is here, where a test can ask it.
//
// No constants/satiety.ts beside this. The reason constants/siege.ts and
// constants/arcade.ts exist is that the screen and the machine have to agree about
// timings — the camera closing and the hero stopping short of the gate are one movement.
// Nothing on screen needs a number from here: the bar is handed a fraction and a boolean.
// So the numbers stay with the rules that use them.

// A full belly, which is also what the bar reads as 1. A fraction rather than a count of
// meals: the bar wants one, and a number of rations would be a second unit to convert
// between for nothing.
export const FULL = 1

// What one leg out of a crossroad costs, at both ends of how well it was answered.
//
// A full bar buys ten crossroads answered in par presses, or five answered with the
// accuracy gone out of them. Those two figures are the whole of the mode's new tension:
// a walled village comes round every two to three fans — see FORT_CHANCE and
// FORT_DRY_MAX — so a player who takes the villages never goes hungry, and a player who
// walks past them is counting.
//
// The gap between the two is deliberately only double. Accuracy should be worth playing
// for without a scrambled answer costing a run outright, because the crossroad clock is
// already punishing haste and two punishments for one mistake is one too many.
export const BITE_MIN = 0.1
export const BITE_MAX = 0.2

// Being pulled back down the way behind, when the crossroad's clock runs out. No accuracy
// relief: there was no answer to be accurate about, and a retreat already costs the depth
// it costs.
//
// Written out rather than aliased to `BITE_MAX`, which it happens to equal today. The two
// are the same number by choice and not by identity — what a bad answer costs and what no
// answer costs are different questions, and tying them together would mean a retreat could
// never be made dearer than the worst walk without making the worst walk dearer too.
export const RETREAT_BITE = 0.2

// How long an empty hero lasts per heart. Three hearts is a fifteen-second fuse, which is
// about two crossroads answered at a normal pace — long enough to run for a village,
// short enough that running for one is the only thing worth doing.
export const STARVE_MS = 5000

// What one answered leg takes out of the bar.
//
// On `accuracyFactor`, which is the curve a hit is scored by everywhere else in the app:
// one at par, decaying with every press over it. So "accurate" means the same thing in
// arcade as it does in a run of Accuracy, and a player who has learned one has learned
// the other.
//
// `par` of nought is what `computePar` answers for a sum no arrangement of the dial
// reaches. It cannot happen at a crossroad — a way's value was chosen *by* what it costs
// — but it is the kind of nought that divides, so `accuracyFactor` flooring par at one is
// doing real work here rather than guarding a case that never comes.
export function biteFor(par: number, presses: number): number {
  return BITE_MIN + (BITE_MAX - BITE_MIN) * (1 - accuracyFactor(par, presses))
}

// What is left after a bite. Clamped at both ends: nothing below empty, because starving
// twice as hard is not a thing, and nothing above full, because a feast on a full belly
// is still a full belly.
export function spent(satiety: number, bite: number): number {
  return Math.min(FULL, Math.max(0, satiety - bite))
}

// Whether the hero is out of food, which is when the hearts start going.
export function starving(satiety: number): boolean {
  return satiety <= 0
}
