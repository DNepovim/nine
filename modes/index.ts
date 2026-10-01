// The modes package, as one import.
//
// A mode is a value: an identity, a dial, and a complete set of rules — see
// modes/types.ts for the contract and modes/definitions for one file per mode. The
// registry holds them, `rulesFor` resolves one into the rules a run is governed by, and
// the engine reads those rules and never names a mode at all.
//
// Everything here used to be one table in machines/modes.ts plus a `mode === 'trainee'`
// in each of a dozen screens. The split is what makes the twentieth mode cost one file
// rather than a dozen edits — which is what **challenges**, twenty-odd custom modes each
// on the app for a day, needs it to cost. See modes/challenges.

export {
  cellCount,
  cellsOf,
  defineDial,
  emptyGrid,
  NINE_DIAL,
  pressGrid,
  setGrid,
  sumOf,
  weightAt,
  weightRows,
  type DialSpec,
  type Grid,
} from './dial'
export { isOpenMode } from './challenges/define'
export { DIFFICULTIES, DIFFICULTY_ORDER, type Difficulty } from './difficulty'
export { ARCADE_TEASER } from './definitions/arcade'
export { TUTORIAL } from './definitions/tutorial'
export {
  DARK_MULTIPLAYER_GRADIENT,
  darkGradientOf,
  getDifficultyColor,
  gradientOf,
  lerpColor,
  MULTIPLAYER_GRADIENT,
} from './palette'
export { decayed } from './ramp'
export {
  allModes,
  baseClockMs,
  descriptionOf,
  headlineOf,
  isMode,
  isModeId,
  labelOf,
  MODE_ORDER,
  modeById,
  openModes,
  rulesFor,
  runLabel,
  runRules,
  runSubmode,
  SCORED_MODES,
  startingLives,
  traitsOf,
  type Mode,
  type ModeId,
  type ScoredMode,
} from './registry'
export { rampedTimeout, spawnInterval, type RunRules } from './rules'
export {
  FAST_HIT_THRESHOLD,
  STREAK_BROKEN,
  STREAK_TRIGGERED,
  streakMultiplier,
} from './streak'
export type { Headline, ShotKind, Submode } from './types'
