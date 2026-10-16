// The stage a run is on, and the one curve every fight gets harder along.
//
// A **stage** is a stretch of a run that one difficulty is held across: how often a road
// has men on it, how many of them there are, how many towers a wall carries and how tall
// they stand, and how fast anyone walks. Advance a stage and all of that steps up at once.
//
// Nothing advances yet. There is one stage — the first and easiest — and `FIRST_STAGE` is
// what every fight is built at; when stages become a thing the hero climbs through, the
// three call sites that name that constant take the run's own stage instead and nothing
// else in here or in the two fights has to change. That is the whole point of this file:
// before it, a siege and an ambush each ramped themselves over *depth*, so the only way to
// make a fight easier was to make a deep run easier too.
//
// Both numbers and the curve in one small module, which is the shape modes/ramp.ts already
// has for the same reason: a ramp read off constants somewhere else would be two places to
// look for one idea.

// The stage every run is on today.
export const FIRST_STAGE = 1

// The stage at which fights stop getting worse. Past it nothing more is added — a run that
// climbs forever should not meet a wall that grows forever with it, which is the rule
// SIEGE_DEPTH_FULL used to carry for depth.
export const STAGE_FULL = 8

// How far into the ramp a stage sits: nought at the first stage and one at `STAGE_FULL`.
// Private: `byStage` is the only thing that ever wants it, and a second reader would be a
// second place deciding what a stage means.
const stageRamp = (stage: number): number =>
  Math.min(1, Math.max(0, (stage - FIRST_STAGE) / (STAGE_FULL - FIRST_STAGE)))

// One figure read off its two ends: what it is at the first stage, what it is at the last,
// and where between them this stage falls.
//
// Straight, not decayed. `decayed` is the curve a *run* tightens along, where what is being
// counted is hits or crossroads and the point is that the squeeze decelerates; a stage is a
// step the game takes deliberately, and a step that got quietly smaller every time would be
// a progression nobody could feel. The two ends are where the tuning lives, and they may
// run either way — a walk gets shorter as a band gets larger.
export const byStage = (one: number, full: number, stage: number): number =>
  one + (full - one) * stageRamp(stage)
