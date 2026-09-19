import { useViewport } from '@/hooks/use-viewport'
import { dialMetrics, type DialMetrics } from '@/lib/dial-metrics'

// The sum readout's slot above the dial. Lessons reserve it even when they have
// no total to show, so the dial never drifts up.
export const SUM_ROW_HEIGHT = 50

// The dial's size, everywhere it is drawn. The arithmetic lives in `lib/dial-metrics`,
// where it can be checked at the sizes that matter — a phone upright, a phone sideways
// — rather than asserted about its own source.
//
// Takes nothing. A button is the same size in the game, a lesson and a room, and the
// only thing it may vary with is the viewport.
export function useDialMetrics(): DialMetrics {
  // The area the app actually occupies, not the browser window it may be framed in —
  // on desktop web the app renders inside a phone frame, and sizing from the window
  // would run the dial well past it.
  return dialMetrics(useViewport())
}
