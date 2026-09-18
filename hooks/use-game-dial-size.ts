import { BEST_SCORES_HEIGHT } from '@/components/game/best-scores-line'
import { useViewport } from '@/hooks/use-viewport'

// The game screen's dial pad is a square of min(width, height) inside a flex-1
// area that splits the leftover height with the targets area. Deriving the same
// number here — rather than measuring whatever space a lesson happens to leave —
// puts the tutorial's dial at exactly the size and position the player will meet
// in a real game, however much copy sits above it.
//
// These mirror app/(tabs)/index.tsx's layout; they only need to be roughly right.
const SCREEN_PADDING_X = 32 // Screen px-4, both sides
const SCREEN_PADDING_Y = 16 // Screen py-2, top + bottom
const HUD_HEIGHT = 70 // mode / NINE / hearts / score block, incl. mb-3

// The sum readout's slot above the dial. Lessons reserve it even when they have
// no total to show, so the dial never drifts up.
export const SUM_ROW_HEIGHT = 50

// Trainee's own readout (hits/accuracy/speed, the praise line, the route hint)
// sits in the targets area, the dial's own flex-1 sibling — and being real content
// rather than an empty reservation, it can't shrink to nothing the way the other
// modes' half does. Per the comment where it's laid out in app/(tabs)/index.tsx,
// that block runs ~85px against the ~25px the board-bests strip takes in the other
// modes, and the ~60px difference comes off the dial's own half, not just the
// targets area's — about 10px a button. Every tutorial screen wears Trainee's
// weight/max badges and ends the run in Trainee, so this is charged unconditionally
// rather than threaded through as a per-lesson mode, and the dial lands at the
// size Trainee actually gives it rather than the size an un-badged mode would.
const TRAINEE_STATS_SHRINK = 30

// Takes nothing. A button is the same size wherever it is drawn — the game, a lesson,
// the controls screen — and the only thing it may vary with is the viewport.
//
// It briefly took an `extraChrome` argument so a lesson could hand back room for its
// heading and callout. That bought the copy its space out of the one thing this function
// exists to hold still: on a 667pt screen it left the tutorial's button at 30pt against
// the game's 78pt, so the gesture a player practised was not the gesture they would
// make. A lesson's chrome comes out of DialStage's `above` band instead, which is
// `flex: 1` and so gives way to zero before the dial gives up a pixel.
export function useGameDialSize(): number {
  // The area the app actually occupies, not the browser window it may be framed
  // in — on desktop web, `useWindowDimensions` reports the whole page, and a dial
  // sized from that ran well past the phone frame the tutorial actually renders in.
  const { width, height } = useViewport()
  // The best-scores strip is in every mode's budget, Trainee included — it reserves the
  // height even though it shows nothing there, precisely so the dial does not change
  // size between modes. Imported rather than written out again: it is one of the numbers
  // this calculation exists to track.
  const chrome = SCREEN_PADDING_Y + BEST_SCORES_HEIGHT + HUD_HEIGHT + SUM_ROW_HEIGHT
  const dialArea = (height - chrome) / 2 - TRAINEE_STATS_SHRINK
  return Math.max(0, Math.floor(Math.min(width - SCREEN_PADDING_X, dialArea)))
}
