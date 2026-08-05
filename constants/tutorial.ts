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

// Screens the player has to *do* something on. In the auto-opened run these gate
// the Next button; when the tutorial is replayed from How to Play they don't.
export const STEP_HAS_TASK = {
  goal: false,
  controls: true,
  weights: true,
  strategy: true,
  modes: false,
  tips: false,
} as const satisfies Record<TutorialStepId, boolean>

// One color per screen, spread across the mode spectrum so progress reads as a
// journey from Trainee blue to Arcade amber.
export const STEP_COLORS: readonly string[] = spreadSpectrum(
  ['#4C7EFF', '#7273D2', '#c36282', '#E5534B', '#FF8C00'],
  TUTORIAL_STEP_COUNT,
)

// ── Lesson tuning ───────────────────────────────────────────────────────────

// Cell indices in the flat 3×3 grid. Top-left is the ×1 fine-tuner, top-middle a
// ×2 mid-weight, bottom-right the ×9 heavy hitter.
export const FINE_CELL = 0
export const MID_CELL = 1
export const COARSE_CELL = 8

// The controls lesson's single button starts at 5 so neither horizontal swipe is
// a no-op (DialButton skips the callback when the value is already 0 or 9).
export const CONTROLS_START_VALUE = 5

// Weights lesson: maxing the ×1 button reaches this, maxing the ×9 button too.
export const WEIGHTS_FINE_SUM = 9
export const WEIGHTS_COARSE_SUM = 90

// Strategy lesson: ×9 twice covers 18, then ×2 and ×1 walk the last 3 in. Note
// this is deliberately not the par route — computePar counts a swipe-to-9 as one
// step, so it reaches 21 in two moves. The lesson teaches how to steer toward a
// number; fewest-moves scoring belongs to Accuracy mode.
export const STRATEGY_TARGET = 21
export const STRATEGY_COARSE_VALUE = 2
// A generous ring — long enough to think, short enough to feel the pressure.
export const STRATEGY_RING_MS = 30_000

// Goal lesson's worked example: 6 × ×1 + 4 × ×9 = 42.
export const GOAL_EXAMPLE_TARGET = 42
export const GOAL_EXAMPLE_FINE = 6
export const GOAL_EXAMPLE_COARSE = 4
