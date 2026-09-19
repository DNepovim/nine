// The space between two buttons, and the only fixed pixel measure in here.
const GAP = 12

// A quarter of the width per button, less the gap it carries.
const BUTTON_SHARE = 0.25

// The most of the screen's height the dial square may take.
//
// This binds only when the screen is wider than it is tall enough to hold the dial —
// in practice a browser window turned sideways, since the native app is locked to
// portrait. There the width-driven square came to 582pt inside a 375pt viewport: the
// rows overlapped, the countdown ring landed on the heading, and two thirds of the
// dial hung off the bottom.
//
// Half is deliberately loose. The cap engages below an aspect ratio of about 1.5, and
// no phone held upright is anywhere near that square — the narrowest are 1.77 — so on
// every device the game is actually played on the button is still exactly a quarter of
// the width less its gap, and this line does nothing.
const HEIGHT_CAP = 0.5

export type DialMetrics = { button: number; gap: number; size: number }

// One button, one gap, and the square the nine of them make.
//
// Width-driven on purpose. Every earlier version of this derived the dial from the
// height left over after the HUD, the score strip, the sum row and Trainee's stat block
// — four hand-maintained numbers modelling a layout nobody measured. It was wrong by
// enough on a real phone that the buttons stopped fitting three to a row and the dial
// collapsed into a column.
//
// The cap is not a return to that. It reads the viewport and nothing else, so it cannot
// drift the way a model of the chrome above the dial did, and it gives the same answer
// in a lesson as in a run — which is the whole point.
//
// That is what makes the size the same in the game, a lesson and a room. A lesson has
// more copy above its dial than a run does, so any height-derived or container-measured
// number differs there by exactly that copy. The viewport does not differ, so neither
// does the button.
//
// The three buttons and two gaps come to `0.75w - 12`, which leaves 12 over the two
// `0.125w` margins the layout asks for. The caller centres the square, so that spare
// splits evenly and each margin lands at `0.125w + 6` — the button and the gap hold
// exactly, and the margin absorbs the remainder, which is the right way round when the
// button is the thing that has to be identical everywhere.
export function dialMetrics(viewport: { width: number; height: number }): DialMetrics {
  const wide = Math.max(0, Math.floor(BUTTON_SHARE * viewport.width) - GAP)
  const square = Math.min(wide * 3 + GAP * 2, Math.floor(HEIGHT_CAP * viewport.height))
  // Back out of the square rather than capping it on its own: the container would
  // shrink while the buttons kept their width, which is how the rows came to overlap
  // by 58pt in a sideways window. The button is what the layout is built from, so it
  // is what the cap has to reach.
  const button = Math.max(0, Math.floor((square - GAP * 2) / 3))
  return { button, gap: GAP, size: button * 3 + GAP * 2 }
}
