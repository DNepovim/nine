import { useViewport } from '@/hooks/use-viewport'
import { dialMetrics, type DialMetrics } from '@/lib/dial-metrics'
import type { DialSpec } from '@/modes'

// The sum readout's slot above the dial. Lessons reserve it even when they have
// no total to show, so the dial never drifts up.
export const SUM_ROW_HEIGHT = 50

// The dial's size, everywhere it is drawn. The arithmetic lives in `lib/dial-metrics`,
// where it can be checked at the sizes that matter — a phone upright, a phone sideways
// — rather than asserted about its own source.
//
// Takes the dial and nothing else. A button is the same size in the game, a lesson and
// a room, and the only two things it may vary with are the viewport and how many keys
// the dial being drawn has — so no screen can ask for a smaller one than another screen
// drawing the same dial.
export function useDialMetrics(dial: DialSpec): DialMetrics {
  // The area the app actually occupies, not the browser window it may be framed in —
  // on desktop web the app renders inside a phone frame, and sizing from the window
  // would run the dial well past it.
  return dialMetrics(useViewport(), dial)
}
