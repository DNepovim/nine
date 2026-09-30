import { TUTORIAL_TARGETS } from '@/constants/tutorial'

// The stepper's rules: which of its numbers may be tapped, and which way the arrows go.
//
// Separate from the row that draws them for the reason every rule in lib/ is: this is the
// half worth a test, and the row is nine lines of NativeWind. The words for it are in the
// domain table — a *step* here is one of the tutorial's five scripted boards, counted from
// nought, so step `n` is the board standing when the run's hit count is `n`.
//
// Two numbers describe where the player is. `current` is the board under them now, and
// `furthest` is the highest they have ever reached in this run — which only play raises,
// never the stepper. Everything below is those two compared.

// One number per scripted board. Derived rather than written down, so a board added to
// TUTORIAL_TARGETS arrives with a number to reach it by.
export const TUTORIAL_STEPS = TUTORIAL_TARGETS.length

// How a number is drawn, and whether it answers a tap. `visited` is the only one that
// does — `current` is where the player already is, and `locked` is ground they have not
// covered.
export type StepState = 'current' | 'visited' | 'locked'

export const stepState = (
  board: number,
  current: number,
  furthest: number,
): StepState => {
  if (board === current) return 'current'
  return board <= furthest ? 'visited' : 'locked'
}

// PREV, live anywhere but the opening board.
export const canGoBack = (current: number): boolean => current > 0

// NEXT, live only for a player standing behind their own furthest — which is to say,
// only for one who went back. This is the whole of the no-skipping rule: the stepper can
// return ground it gave up and can never hand out ground the player has not played.
export const canGoForward = (current: number, furthest: number): boolean =>
  current < furthest
