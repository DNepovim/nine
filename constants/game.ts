// The dial's own ceiling is a property of the board a run is played on — see
// `maxSum` on DialSpec — so it is not in here any more. Anything that needs it takes
// the board it is drawing.
export const SWIPE_THRESHOLD = 20

// How far onto a key the finger has to get before a key it arrived at mid-drag answers
// at all, as a share of the distance between two key centres. Read against the dial's
// own geometry, so it means the same thing on a dial with twice the keys — see
// `crossReach` in lib/dial-gesture.ts for what is being measured.
export const CROSSING_SHARE = 0.35

// Target card / countdown pie geometry (the card footprint is the pie itself).
export const PIE_SIZE = 80
export const CARD_GAP = 10

// How long a target card takes to come in — it fades up from nothing and springs from
// six-tenths of its size. A number is not readable until this is over, so a **glimpse**
// is counted from here rather than from the mount.
export const CARD_ENTER_MS = 180

// How long a glimpsed number takes to go, and to come back when its card leaves.
// Short, because the glimpse itself is the half second the player was promised: the fade
// is the edge of it rather than more of it. Also the least of a glimpse worth showing —
// a card left with less than this would only flash its number to fade it again.
export const GLIMPSE_FADE_MS = 150
