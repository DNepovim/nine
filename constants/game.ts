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
