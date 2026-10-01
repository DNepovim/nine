// Arcade's timings and sizes, in one table because the screen, the ways, the buds and the
// hero all have to agree about them: the canvas drifts for exactly as long as the hero
// walks, and the chosen bud is absorbed in exactly that time too. A beat tuned in one
// place and not the others would read as three things happening at once rather than as one
// movement.

// A crossroad blooming: how long one way takes to draw itself on, and how far apart the
// ways of a fan start. The bloom is over when the last of four has finished — a fan builds
// rather than arriving all at once.
export const GROW_MS = 520
export const STAGGER_MS = 90
export const BLOOM_MS = GROW_MS + STAGGER_MS * 3

// The hero walking a way, and the canvas drifting the same distance in the same time.
export const WALK_MS = 880

// Being pulled back down the way behind. Faster than the walk and in one motion, so it
// reads as happening *to* the player rather than as a move they made.
export const RETREAT_MS = 620

// The fall into the mouth, which is the retreat the first crossroad has no room for.
export const FALL_MS = 620

// Ways the hero refused, trimming from the tip back into the crossroad. Shorter than the
// walk, so they are gone by the time it lands.
export const WITHER_MS = 520

// How many crossroads of history stay on the canvas. Enough to say where the run came
// from; more would fill it with places nobody can reach again.
export const TRAIL_DEPTH = 3

// How far down the canvas the hero stands. Below the middle, because what matters is the
// fan above it — the ways behind only have to be legible, not readable.
export const ANCHOR = 0.7

// The bud that holds a target, and the hero that walks to it.
export const BUD_SIZE = 34
export const HERO_SIZE = 15

// The box one crossroad's ways are drawn in, as a multiple of the pitch. A way reaches at
// most 1.14 pitches and sways a little past that, so this clears the longest of them.
export const STEM_BOX = 2.6
