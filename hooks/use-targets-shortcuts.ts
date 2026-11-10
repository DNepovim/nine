import { Gesture } from 'react-native-gesture-handler'

// How long the targets area has to be held before the run starts over. Long enough that
// a thumb resting on the screen between targets never trips it.
const RESTART_HOLD_MS = 3000

// Two shortcuts on the targets area, for a thumb that is already on the screen: a double
// tap pauses, and a hold restarts the run where it stands — the pause screen's RESTART
// without the trip through it. Exclusive, so a hold is never also read as a tap.
//
// Both are off outside a live run, and off in the tutorial: its lesson is scripted
// against one run, and its cards are tapped on this same canvas.
//
// A board that is drawn on gives the canvas a use of its own: `onPlot` hears every single tap,
// with where it fell. The double tap stays, told apart by where the second tap lands — on the
// first, within `SAME_SPOT`, it pauses; further off it is a second point. The cost is that a
// single tap is only plotted once the double tap's window (`PLOT_WINDOW_MS`, shorter than the
// default) has closed on it.
export function useTargetsShortcuts({
  playing,
  tutorial,
  onPause,
  onRestart,
  onPlot = null,
}: {
  playing: boolean
  tutorial: boolean
  onPause: () => void
  onRestart: () => void
  onPlot?: ((x: number, y: number) => void) | null
}) {
  const enabled = playing && !tutorial
  const plots = onPlot !== null
  const pair = Gesture.Tap().numberOfTaps(2)
  const doubleTap = plots
    ? pair.maxDelay(PLOT_WINDOW_MS).maxDeltaX(SAME_SPOT).maxDeltaY(SAME_SPOT)
    : pair
  // Listed in the order they win: the double tap before the single, so the single waits for
  // the double to fail.
  return Gesture.Exclusive(
    Gesture.LongPress()
      .minDuration(RESTART_HOLD_MS)
      // A finger that wanders this far is dragging, not holding.
      .maxDistance(24)
      .enabled(enabled)
      .runOnJS(true)
      .onStart(onRestart),
    doubleTap
      .enabled(enabled)
      .runOnJS(true)
      .onEnd((_event, success) => {
        if (success) onPause()
      }),
    Gesture.Tap()
      .numberOfTaps(1)
      .enabled(enabled && plots)
      .runOnJS(true)
      .onEnd((event, success) => {
        if (success) onPlot?.(event.x, event.y)
      }),
  )
}

// How long a second tap has, and how far from the first it may land, for the double tap on a
// board that is drawn on.
const PLOT_WINDOW_MS = 300
const SAME_SPOT = 40
