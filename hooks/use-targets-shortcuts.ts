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
export function useTargetsShortcuts({
  playing,
  tutorial,
  onPause,
  onRestart,
}: {
  playing: boolean
  tutorial: boolean
  onPause: () => void
  onRestart: () => void
}) {
  const enabled = playing && !tutorial
  return Gesture.Exclusive(
    Gesture.LongPress()
      .minDuration(RESTART_HOLD_MS)
      // A finger that wanders this far is dragging, not holding.
      .maxDistance(24)
      .enabled(enabled)
      .runOnJS(true)
      .onStart(onRestart),
    Gesture.Tap()
      .numberOfTaps(2)
      .enabled(enabled)
      .runOnJS(true)
      .onEnd((_event, success) => {
        if (success) onPause()
      }),
  )
}
