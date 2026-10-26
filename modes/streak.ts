// What extends a mode's streak. `optimal` and `fast` are chains of decisions — every
// matching hit either builds them or breaks them — where `clear` depends on the spawn
// timing cooperating, so most hits leave it untouched.
export type StreakTrigger =
  'optimal' | 'fast' | 'clear' | 'whole' | 'spread' | 'doubled' | 'none'

// A hit counts as fast when this much of the target's ring is still full.
export const FAST_HIT_THRESHOLD = 0.6

// What a hit batch did, as far as the streak rules care.
export type StreakFacts = {
  anyHit: boolean
  allOptimal: boolean
  allFast: boolean
  allWhole: boolean
  allSpread: boolean
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
  // A key moved in every row of the dial on the way to the target — see `everyRowMoved`.
  //
  // `whole`'s rule for a dial too wide to ask for all of: on sixteen keys a route through
  // every one of them is not a route, where a route through every row is four keys and an
  // ordinary thing to do deliberately. It pulls against the score the same way, and
  // measurably: on the 4 × 4 it costs a median of one extra press over par — an accuracy
  // factor of 0.90 — and the cost is concentrated where the cheap answer is two keys. A
  // par route on that dial already uses five keys of the sixteen, so about half of targets
  // satisfy this for nothing; it is the small ones the player has to decide about.
  //
  // One target in a hundred cannot satisfy it at all, and breaks the chain with nothing
  // the player could have done: four rows of a 4 × 4 cannot add up to less than ten, so
  // every target under that is out of reach of the rule rather than of the dial. Left
  // standing rather than carved out — knowing a target is unsatisfiable means a
  // constrained pass over the whole range on every spawn, which is far more than a streak
  // fact may cost.
  spread: ({ anyHit, allSpread }) => anyHit && allSpread,
  // Not a streak at all: a hit that empties the board is worth double, and nothing
  // builds, breaks or carries from one hit to the next — see `applyGrid` in
  // machines/game.ts, which is where the doubling is. The rule Trainee has always had,
  // kept under its own name so that `none` can mean none.
  doubled: () => false,
  // Nothing. No hit is ever worth more than its own blend, and the run counts no strikes.
  none: () => false,
} as const satisfies Record<StreakTrigger, (facts: StreakFacts) => boolean>

// Whether a hit batch breaks it. A streak only feels like a chain when both halves
// are in play: `optimal`, `fast`, `whole` and `spread` are broken by a matching hit that
// missed the mark, where `clear` is never broken by a hit — only by a target running out.
export const STREAK_BROKEN = {
  optimal: ({ anyHit }) => anyHit,
  fast: ({ anyHit }) => anyHit,
  clear: () => false,
  whole: ({ anyHit }) => anyHit,
  spread: ({ anyHit }) => anyHit,
  doubled: () => false,
  none: () => false,
} as const satisfies Record<StreakTrigger, (facts: StreakFacts) => boolean>

// ×2 → ×4 → ×8 (capped). streakCount = consecutive triggers; 0 ⇒ ×1.
export const streakMultiplier = (streakCount: number): number =>
  streakCount <= 0 ? 1 : Math.min(8, 2 ** streakCount)
