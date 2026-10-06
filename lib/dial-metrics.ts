// The space between two buttons, and the only fixed pixel measure in here.
const GAP = 16

// How much of the width one button gets, as one share per column plus one over: on the
// three-column dial the game is played on that is a quarter of the width, less the gap
// the button carries, and the spare share is what the two margins are cut from.
const buttonShare = (cols: number): number => 1 / (cols + 1)

// The most of the screen's height the dial square may take.
//
// This binds only when the screen is wider than it is tall enough to hold the dial —
// in practice a browser window turned sideways, since the native app is locked to
// portrait. There the width-driven square came to 578pt inside a 375pt viewport: the
// rows overlapped, the countdown ring landed on the heading, and two thirds of the
// dial hung off the bottom.
//
// Half is deliberately loose. The cap engages below an aspect ratio of about 1.5, and
// no phone held upright is anywhere near that square — the narrowest are 1.77 — so on
// every device the game is actually played on the button is still exactly a quarter of
// the width less its gap, and this line does nothing.
const HEIGHT_CAP = 0.5

// One button, the gap between two of them, and the box the whole dial occupies.
//
// `width` and `height` rather than one `size`, because a dial is only square when it has
// as many columns as rows — which every dial shipped today does, and a challenge's need
// not.
export type DialMetrics = {
  button: number
  gap: number
  width: number
  height: number
}

// One button, one gap, and the box the keys make.
//
// Width-driven on purpose. Every earlier version of this derived the dial from the
// height left over after the HUD, the score strip, the sum row and Trainee's stat block
// — four hand-maintained numbers modelling a layout nobody measured. It was wrong by
// enough on a real phone that the buttons stopped fitting three to a row and the dial
// collapsed into a column.
//
// The cap is not a return to that. It reads the viewport and the dial's own shape, and
// nothing else — so it cannot drift the way a model of the chrome above the dial did, and
// it gives the same answer in a lesson as in a run, which is the whole point.
//
// That is what makes the size the same in the game, a lesson and a room. A lesson has
// more copy above its dial than a run does, so any height-derived or container-measured
// number differs there by exactly that copy. The viewport does not differ, so neither
// does the button.
//
// On the three-column dial the game is played on, the three buttons and two gaps come to
// `0.75w - 16`, which leaves 16 over the two `0.125w` margins the layout asks for. The
// caller centres the box, so that spare splits evenly and each margin lands at
// `0.125w + 8` — the button and the gap hold exactly, and the margin absorbs the
// remainder, which is the right way round when the button is the thing that has to be
// identical everywhere.
//
// The shape it is drawn in arrives as plain numbers rather than as a `DialSpec`, so this
// file still imports nothing at all — see its test, which asserts exactly that.
export function dialMetrics(
  viewport: { width: number; height: number },
  shape: { rows: number; cols: number },
): DialMetrics {
  const { rows, cols } = shape
  if (rows <= 0 || cols <= 0) return { button: 0, gap: GAP, width: 0, height: 0 }
  const wide = Math.max(0, Math.floor(buttonShare(cols) * viewport.width) - GAP)
  const across = Math.min(
    wide * cols + GAP * (cols - 1),
    // The height cap is measured against the taller of the two axes, so a dial with more
    // rows than columns is capped by the rows it actually has.
    Math.floor(((HEIGHT_CAP * viewport.height - GAP * (rows - 1)) / rows) * cols) +
      GAP * (cols - 1),
  )
  // Back out of the box rather than capping it on its own: the container would shrink
  // while the buttons kept their width, which is how the rows came to overlap by 58pt in
  // a sideways window. The button is what the layout is built from, so it is what the cap
  // has to reach.
  const button = Math.max(0, Math.floor((across - GAP * (cols - 1)) / cols))
  // A viewport of zero is not a small screen, it is a screen not measured yet — and it
  // reached production once, as a 24pt box holding nine buttons with no width and their
  // digits spilling down the page. There is no dial without a button, so it has no box
  // either, and what draws in that box is nothing rather than wreckage.
  if (button === 0) return { button: 0, gap: GAP, width: 0, height: 0 }
  return {
    button,
    gap: GAP,
    width: button * cols + GAP * (cols - 1),
    height: button * rows + GAP * (rows - 1),
  }
}
