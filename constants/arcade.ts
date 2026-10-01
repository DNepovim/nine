// Arcade's timings and sizes, in one table because the screen, the ways, the buds and the
// hero all have to agree about them: the canvas drifts for exactly as long as the hero
// walks, and the chosen bud is absorbed in exactly that time too. A beat tuned in one
// place and not the others would read as three things happening at once rather than as one
// movement.

// The card a run opens on, before a single way is drawn: how long it is up, and how long it
// takes to leave. The leaving overlaps the first bloom underneath it — the words fade off
// *into* the opening crossroad rather than clearing the screen and handing it over.
//
// The one unhurried beat in arcade, and deliberately so: everything after it is answered
// against a clock, and a card that was gone before it had been read would be a cut dressed
// up as an opening. Long enough to be read, to hold, and to drift — see
// components/game/arcade-dawn.tsx, which spreads its own movement across exactly this.
export const DAWN_MS = 2400
export const DAWN_OUT_MS = 560

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

// A strike: the hero taking two ways in one movement, through a crossroad it never stops
// at. Longer than a walk but nowhere near twice as long — that gap is the whole point,
// because it is what the player reads as speed.
export const ROCKET_MS = 1180

// Where the accelerating half ends and the settling half begins. Before it the hero is
// leaving a crossroad under power; after it, arriving at one.
export const ROCKET_SPLIT = 0.46

// How long STRIKE stays up over the crossroad that earned it.
export const STRIKE_MS = 900

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
// A town is as wide as the number inside it needs, plus its wall. Three digits at the size
// they are now want a 33pt clear circle, and the wall and its merlons stand outside that.
export const BUD_SIZE = 42
export const HERO_SIZE = 15

// The box one crossroad's ways are drawn in, as a multiple of the pitch. A way reaches at
// most 1.14 pitches and sways a little past that, so this clears the longest of them.
export const STEM_BOX = 2.6
