import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'

// The rung a run is played on. Orthogonal to the mode: a mode says what the run asks
// for, a difficulty says how hard it asks — so a new mode gets all three for free, and a
// mode that has no use for them pins itself to one (see `fixedDifficulty`).
export type Difficulty = 'easy' | 'hard' | 'extreme'

export const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'hard', 'extreme']

type DifficultyConfig = {
  label: MessageDescriptor
  // The label at a glance, for rows too tight to spell it out — the medal line under
  // the title. Lives beside the label so the two cannot drift.
  code: MessageDescriptor
  timeoutScale: number
  maxTargets: number
  // A hit scoring below this costs a life, in a mode whose lives work that way (see
  // `wastefulCostsLife`). Counter-intuitively tightest on Easy rather than Extreme —
  // Easy's slack lives in the clock (timeoutScale 1.45 gives far more room to find the
  // optimal route), so a hit that's still wasteful despite all that time is the one
  // difficulty can afford to call out. Extreme's clock is already the run's whole fight;
  // asking for a tight route on top of it would be punishing the same thing twice.
  wastefulThreshold: number
  // What a point scored here is worth once boards are added together — see
  // `lifetimeOf` in lib/player-profile.ts, the one place in the app that sums across
  // difficulties.
  //
  // A hit is worth the same hundred points whatever the difficulty: `computeHitPoints`
  // has no difficulty term, and difficulty is spent entirely on the clock above. But a
  // longer clock lifts both factors that hundred is blended from — more seconds to find
  // the optimal route, more of the ring left when the hit lands — and keeps lives alive
  // longer, so Easy pays more per hit *and* more hits per run. Added up flat, a career
  // spent on Easy outranks one spent on Extreme. This is what puts that right.
  //
  // Deliberately not applied to a run, a board or a record: a leaderboard is already one
  // mode × difficulty, so nothing there is ever compared across the three.
  scoreWeight: number
}

// Hard is the one that counts for itself, with Easy at half and Extreme at double — a
// ×4 spread across the three, and a rule short enough to say out loud.
export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  easy: {
    label: msg`EASY`,
    code: msg`ESY`,
    timeoutScale: 1.45,
    maxTargets: 3,
    wastefulThreshold: 0.25,
    scoreWeight: 0.5,
  },
  hard: {
    label: msg`HARD`,
    code: msg`HRD`,
    timeoutScale: 0.75,
    maxTargets: 3,
    wastefulThreshold: 0.2,
    scoreWeight: 1,
  },
  extreme: {
    label: msg`EXTREME`,
    code: msg`EXT`,
    timeoutScale: 0.5,
    maxTargets: 4,
    wastefulThreshold: 0.15,
    scoreWeight: 2,
  },
}

// Difficulty as a position on a mode's gradient: easy = start, extreme = end.
export const DIFFICULTY_T: Record<Difficulty, number> = {
  easy: 0,
  hard: 0.5,
  extreme: 1,
}
