// What extends a mode's streak. `optimal` and `fast` are chains of decisions — every
// matching hit either builds them or breaks them — where `clear` depends on the spawn
// timing cooperating, so most hits leave it untouched.
export type StreakTrigger = 'optimal' | 'fast' | 'clear' | 'whole' | 'none'

// A hit counts as fast when this much of the target's ring is still full.
export const FAST_HIT_THRESHOLD = 0.6

// What a hit batch did, as far as the streak rules care.
export type StreakFacts = {
  anyHit: boolean
  allOptimal: boolean
  allFast: boolean
  allWhole: boolean
  clearedBoard: boolean
}

// Whether a hit batch extends the streak. One predicate per trigger, so adding a
// mode's rule means adding a row here rather than another branch in a conditional.
export const STREAK_TRIGGERED = {
  optimal: ({ anyHit, allOptimal }) => anyHit && allOptimal,
  fast: ({ anyHit, allFast }) => anyHit && allFast,
  clear: ({ clearedBoard }) => clearedBoard,
  // Every key on the dial moved on the way to the target. A chain of decisions like
  // `optimal` and `fast`, and the only one of the three that pulls *against* the score:
  // the cheapest route rarely wants all four keys, so taking the streak costs accuracy
  // and the player is choosing between them on every target. That trade is the rule.
  //
  // A challenge's, and only a challenge's — see `everyKeyMoved`. Nine keys is not a
  // route.
  whole: ({ anyHit, allWhole }) => anyHit && allWhole,
  none: () => false,
} as const satisfies Record<StreakTrigger, (facts: StreakFacts) => boolean>

// Whether a hit batch breaks it. A streak only feels like a chain when both halves
// are in play: `optimal`, `fast` and `whole` are broken by a matching hit that missed
// the mark, where `clear` is never broken by a hit — only by a target running out.
export const STREAK_BROKEN = {
  optimal: ({ anyHit }) => anyHit,
  fast: ({ anyHit }) => anyHit,
  clear: () => false,
  whole: ({ anyHit }) => anyHit,
  none: () => false,
} as const satisfies Record<StreakTrigger, (facts: StreakFacts) => boolean>

// ×2 → ×4 → ×8 (capped). streakCount = consecutive triggers; 0 ⇒ ×1.
export const streakMultiplier = (streakCount: number): number =>
  streakCount <= 0 ? 1 : Math.min(8, 2 ** streakCount)
