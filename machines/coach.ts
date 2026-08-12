import { isNonEmptyArray } from 'narrowland'

import { computeSum, type Grid, type Target } from './game'
import { cellWeight, computePar } from './scoring'

// How many presses in a row must fail to shorten the route before the coach says
// so. One is a fumble the player already knows about; three in a row means the route
// is lost, and that is the teachable moment. Speaking on every unhelpful press would
// have the line talking through a beginner's first targets, and a line that always
// talks stops being read.
const LOST_PRESSES = 3

// Presses in a row on one key, one direction, before the coach suggests a swipe.
// Four is past the point where a swipe to 0 or 9 was the cheaper gesture.
const TAP_RUN = 4

// A gap this wide makes a fine key the wrong opener: at ×1 it is a dozen presses
// where a ×9 covers most of it in one. Below it a fine key can be the right call and
// the coach would be wrong to say otherwise. The one figure here tuned by feel.
const COARSE_GAP = 12

// Which keys count as fine. Weights run 1, 2, 3, 2, 4, 6, 3, 6, 9.
const FINE_WEIGHT = 2

const isFineKey = (index: number): boolean => cellWeight(index) <= FINE_WEIGHT

// Targets that must leave the board before the same habit may be named again.
// Trainee has infinite lives, so a run ends only when the player does — once per run
// would leave a long run uncoached, and once per occurrence would nag.
const HABIT_COOLDOWN_TARGETS = 8

// The verdicts a single press can earn. `lib/coach-lines.ts` holds their words.
export type PressVerdict = 'lost' | 'tapping' | 'coarse'

// A run of presses on one key in one direction. Broken by any other key, by a
// reversal, and by a swipe — which is what makes the tapping habit detectable at
// all: the run only grows while the player is doing the thing being named.
type TapRun = { index: number; delta: 1 | -1; count: number }

export type CoachState = {
  // Presses in a row that got the player no closer to anything.
  unhelpful: number
  // Whether `lost` has already been said for the current run of them.
  lostSaid: boolean
  tapRun: TapRun | null
  // Targets resolved since each habit was last named.
  sinceTapping: number
  sinceCoarse: number
}

// The cool-downs start already satisfied, so the first occurrence of a habit is
// named at once rather than after the eighth target of the run.
export const initialCoachState = (): CoachState => ({
  unhelpful: 0,
  lostSaid: false,
  tapRun: null,
  sinceTapping: HABIT_COOLDOWN_TARGETS,
  sinceCoarse: HABIT_COOLDOWN_TARGETS,
})

// What one press did, in the terms the rules are written in.
export type PressFacts = {
  index: number
  // Which way a press moved the key, or null for a swipe. A swipe sets an absolute
  // value, and it is what breaks a tap run.
  delta: 1 | -1 | null
  // Whether the press got the player closer to any live target.
  improved: boolean
  // Whether this was the first press toward the nearest target since its reference
  // was last set — the moment at which a coarse key is the right opener or not.
  opening: boolean
  // |value − sum| for the nearest target, measured before the press.
  gap: number
  // False when the board is empty: nothing to route toward, so nothing to judge.
  routing: boolean
}

// Turns the machine's own grid and targets into facts. This is where the analysis
// happens: `computePar` twice per live target, once for the grid before the press
// and once for the grid after.
export function pressFacts(opts: {
  index: number
  delta: 1 | -1 | null
  gridBefore: Grid
  gridAfter: Grid
  targets: readonly Target[]
}): PressFacts {
  const { index, delta, gridBefore, gridAfter, targets } = opts
  if (!isNonEmptyArray(targets)) {
    return { index, delta, improved: false, opening: false, gap: 0, routing: false }
  }

  const sum = computeSum(gridBefore)
  const nearest = targets.reduce((best, candidate) =>
    Math.abs(candidate.value - sum) < Math.abs(best.value - sum) ? candidate : best,
  )

  return {
    index,
    delta,
    // Any target, not the nearest: up to four can be in the air and there is no way
    // to know which one the player is working toward, so a press that advanced the
    // second-nearest must not be called a mistake.
    improved: targets.some(
      (candidate) =>
        computePar(gridAfter, candidate.value) < computePar(gridBefore, candidate.value),
    ),
    // The machine's own bookkeeping answers this: `userSteps` counts presses since
    // the target's reference was set, so zero means this press is the first.
    opening: nearest.userSteps === 0,
    // By raw value, not by par. What a coarse key answers is how much sum there is
    // left to cover; par answers a different question.
    gap: Math.abs(nearest.value - sum),
    routing: true,
  }
}

type CoachResult = { state: CoachState; verdict: PressVerdict | null }

// Same key, same direction extends the run; any other press starts a new one; a
// swipe ends it.
function nextTapRun(current: TapRun | null, facts: PressFacts): TapRun | null {
  const { delta, index } = facts
  if (delta === null) return null
  if (current !== null && current.index === index && current.delta === delta) {
    return { ...current, count: current.count + 1 }
  }
  return { index, delta, count: 1 }
}

// One press in, at most one verdict out. Every rule and every threshold lives here,
// which is what makes the coach's whole behaviour testable without React.
export function coachReducer(state: CoachState, facts: PressFacts): CoachResult {
  // Presses with an empty board are idle fiddling. Nothing is judged, and the tap
  // run is dropped so it cannot span the gap and surface against the next target.
  // `unhelpful` is deliberately left standing, unlike the tap run — a gap with no
  // target on the board is not itself evidence of anything, so it neither adds to
  // the count nor clears it. The hook zeroes it via `noteResolved` when the board
  // empties, not here.
  if (!facts.routing) return { state: { ...state, tapRun: null }, verdict: null }

  const tapRun = nextTapRun(state.tapRun, facts)
  const unhelpful = facts.improved ? 0 : state.unhelpful + 1
  const lostSaid = facts.improved ? false : state.lostSaid
  const advanced: CoachState = { ...state, tapRun, unhelpful, lostSaid }

  // A tap run can carry into an opening press without any hit at all: a newly spawned
  // target can become the nearest one with `userSteps === 0`, so the very next press
  // on the key already being tapped is both a continuation of the run and an opener.
  // Both habits can qualify at once. Tapping wins: several presses of evidence beat
  // one.
  if (
    tapRun !== null &&
    tapRun.count >= TAP_RUN &&
    state.sinceTapping >= HABIT_COOLDOWN_TARGETS
  ) {
    return { state: { ...advanced, sinceTapping: 0 }, verdict: 'tapping' }
  }

  if (
    facts.opening &&
    isFineKey(facts.index) &&
    facts.gap >= COARSE_GAP &&
    state.sinceCoarse >= HABIT_COOLDOWN_TARGETS
  ) {
    return { state: { ...advanced, sinceCoarse: 0 }, verdict: 'coarse' }
  }

  // Said once per run of unhelpful presses rather than again on every press past the
  // third: the counter has to clear before it can be said again.
  if (unhelpful >= LOST_PRESSES && !advanced.lostSaid) {
    return { state: { ...advanced, lostSaid: true }, verdict: 'lost' }
  }

  return { state: advanced, verdict: null }
}

// Targets left the board — hit, or run out. Whatever the player was working toward
// is gone, so the route counters clear; the habit cool-downs advance by however many
// went.
export function noteResolved(state: CoachState, resolved: number): CoachState {
  return {
    unhelpful: 0,
    lostSaid: false,
    tapRun: null,
    sinceTapping: state.sinceTapping + resolved,
    sinceCoarse: state.sinceCoarse + resolved,
  }
}
