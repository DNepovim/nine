import { sampleSpectrum, spreadSpectrum } from '@/lib/spectrum'

// The arc every step's colour (or pair of colours) is drawn from — Trainee blue
// through to Arcade amber. Kept as one stop list so the primary and accent tones
// below are guaranteed to come from the same journey rather than drift apart.
const SPECTRUM_STOPS = ['#4C7EFF', '#7273D2', '#c36282', '#E5534B', '#FF8C00']

// The tutorial's screens, in order. The stepper draws one segment per entry.
export const TUTORIAL_STEPS = [
  'goal',
  'controls',
  'weights',
  'strategy',
  'swipe',
  'modes',
] as const

export type TutorialStepId = (typeof TUTORIAL_STEPS)[number]

export const TUTORIAL_STEP_COUNT = TUTORIAL_STEPS.length

// Where the forward button goes, per screen — the destination, not a sentence about
// it. A bare "NEXT" says nothing, but the full invitation ("SEE WHY POSITION MATTERS")
// made for a button the size of a primary CTA, sharing the dial screens' one flexible
// band with the target it was crowding. The arrow supplies the verb.
export const STEP_CTA = {
  goal: 'CONTROLS',
  controls: 'POSITION',
  weights: 'PRACTICE',
  strategy: 'SWIPE',
  swipe: 'MODES',
  // The last one keeps its full promise: it starts a run rather than turning a page.
  modes: 'PLAY TRAINEE',
} as const satisfies Record<TutorialStepId, string>

// One color per screen, spread across the mode spectrum so progress reads as a
// journey from Trainee blue to Arcade amber. Carries the heading and the screen's
// main instruction — the voice doing the teaching.
export const STEP_COLORS: readonly string[] = spreadSpectrum(
  SPECTRUM_STOPS,
  TUTORIAL_STEP_COUNT,
)

// A second tone per screen, sampled half a step further along the same arc — close
// enough to read as a companion to STEP_COLORS rather than a clash, distinct enough
// to tell apart. Reserved for whatever on a slide is live or interactive rather than
// instructional: a dial hint, a running readout, the closing callout — so every
// lesson carries two colours instead of one flat tint repeated across everything.
//
// The last step looks back rather than forward — sampling ahead of it would clamp
// to the arc's own end stop, landing on the exact colour STEP_COLORS already used.
export const STEP_ACCENT_COLORS: readonly string[] = Array.from(
  { length: TUTORIAL_STEP_COUNT },
  (_, i) => {
    const half = 0.5 / (TUTORIAL_STEP_COUNT - 1)
    const t =
      i === TUTORIAL_STEP_COUNT - 1
        ? i / (TUTORIAL_STEP_COUNT - 1) - half
        : i / (TUTORIAL_STEP_COUNT - 1) + half
    return sampleSpectrum(SPECTRUM_STOPS, t)
  },
)

// ── Lesson tuning ───────────────────────────────────────────────────────────

// A beat between finishing a screen's task and being carried to the next one, so
// the success state registers before the screen changes.
export const AUTO_ADVANCE_MS = 1100

// Cell indices in the flat 3×3 grid. Top-left is the ×1 fine-tuner, top-middle a
// ×2 mid-weight, bottom-right the ×9 heavy hitter.
export const FINE_CELL = 0
export const MID_CELL = 1
export const COARSE_CELL = 8

// The controls lesson's single button starts at 5 so the swipe-right task isn't a
// no-op (DialButton skips the callback when the value is already 9).
export const CONTROLS_START_VALUE = 5

// Weights lesson: the same handful of taps on three different buttons, so the
// only thing that changes is where they land.
export const WEIGHTS_TAPS = 3

// How long a finished round's total holds before the board clears for the next one.
// Long enough to read the total and the equation beside it, short enough that the
// next prompt — which opens by saying the board is cleared — is telling the truth by
// the time it appears.
export const WEIGHTS_CLEAR_DELAY_MS = 650

// Strategy lesson: ×9 twice covers 18, then ×2 and ×1 walk the last 3 in. Note
// this is deliberately not the par route — computePar counts a swipe-to-9 as one
// step, so it reaches 21 in two moves. The lesson teaches how to steer toward a
// number; fewest-moves scoring belongs to Accuracy mode.
export const STRATEGY_TARGET = 21
export const STRATEGY_COARSE_VALUE = 2
// A generous ring — long enough to think, short enough to feel the pressure.
export const STRATEGY_RING_MS = 30_000

// Swipe lesson: two deliberate overshoots — ×1 and ×2 both swiped straight to 9 —
// then one swipe left clears the ×1 button back off, landing on 18. The sequence is
// fixed rather than steered, so there's nothing to plan, only to execute — the ring
// gets a shorter fuse than Strategy's for that reason.
export const SWIPE_TARGET = 18
export const SWIPE_RING_MS = 20_000

// The opening screen is a live mock of the game screen. A three-digit target
// nobody could dial in five seconds is the point: the ring empties, and the
// screen moves on to explain how.
export const GOAL_TARGET = 137
export const GOAL_RING_MS = 5000
// "But how?" lands mid-countdown, once the puzzle has had a moment to sink in.
export const GOAL_HOW_DELAY_MS = 2200
