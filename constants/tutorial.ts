import { spreadSpectrum } from '@/lib/spectrum'

// The tutorial's screens, in order. The stepper draws one segment per entry.
export const TUTORIAL_STEPS = [
  'goal',
  'controls',
  'weights',
  'strategy',
  'modes',
  'tips',
] as const

export type TutorialStepId = (typeof TUTORIAL_STEPS)[number]

export const TUTORIAL_STEP_COUNT = TUTORIAL_STEPS.length

// Screens that report their own completion — by finishing a task, or on the
// opening screen by its countdown running out. In the gated run these carry the
// player forward themselves and so need no CTA; the rest show one.
export const STEP_SELF_ADVANCES = {
  goal: true,
  controls: true,
  weights: true,
  strategy: true,
  modes: false,
  tips: false,
} as const satisfies Record<TutorialStepId, boolean>

// What the forward button promises, per screen. A label that names what comes
// next reads as an invitation; a bare "NEXT" doesn't.
export const STEP_CTA = {
  goal: 'LET’S TRY THE CONTROLS',
  controls: 'SEE WHY POSITION MATTERS',
  weights: 'NOW PUT IT TO WORK',
  strategy: 'MEET THE MODES',
  modes: 'A FEW LAST TIPS',
  tips: 'PLAY TRAINEE',
} as const satisfies Record<TutorialStepId, string>

// One color per screen, spread across the mode spectrum so progress reads as a
// journey from Trainee blue to Arcade amber.
export const STEP_COLORS: readonly string[] = spreadSpectrum(
  ['#4C7EFF', '#7273D2', '#c36282', '#E5534B', '#FF8C00'],
  TUTORIAL_STEP_COUNT,
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

// The controls lesson's single button starts at 5 so neither horizontal swipe is
// a no-op (DialButton skips the callback when the value is already 0 or 9).
export const CONTROLS_START_VALUE = 5

// Weights lesson: the same handful of taps on three different buttons, so the
// only thing that changes is where they land.
export const WEIGHTS_TAPS = 3

// Strategy lesson: ×9 twice covers 18, then ×2 and ×1 walk the last 3 in. Note
// this is deliberately not the par route — computePar counts a swipe-to-9 as one
// step, so it reaches 21 in two moves. The lesson teaches how to steer toward a
// number; fewest-moves scoring belongs to Accuracy mode.
export const STRATEGY_TARGET = 21
export const STRATEGY_COARSE_VALUE = 2
// A generous ring — long enough to think, short enough to feel the pressure.
export const STRATEGY_RING_MS = 30_000

// The opening screen is a live mock of the game screen. A three-digit target
// nobody could dial in five seconds is the point: the ring empties, and the
// screen moves on to explain how.
export const GOAL_TARGET = 137
export const GOAL_RING_MS = 5000
// "But how?" lands mid-countdown, once the puzzle has had a moment to sink in.
export const GOAL_HOW_DELAY_MS = 2200
