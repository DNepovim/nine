import { NINE_DIAL, type DialSpec } from './dial'
import { DIFFICULTIES, type Difficulty } from './difficulty'
import { decayed, type RampTarget } from './ramp'
import type {
  Capabilities,
  Headline,
  LivesRules,
  RulesPatch,
  ScoringRules,
  Submode,
  TargetRules,
} from './types'

// What a perfect hit is worth before the accuracy/speed blend, in a mode that does not
// name its own figure.
const SCORE_BASE = 100

// The ordinary scored run, and what every mode is written as a difference from.
//
// A base rather than each slice spelling out all six groups: twenty modes each restating
// "three lives, a third of the clock between arrivals, the nine dial" is twenty places
// for one of them to be quietly wrong, and a slice that only says what is unusual about
// it reads as what the mode *is*.
//
// The figures here are Accuracy's, because Accuracy is the game at rest: a clock that
// does not move, the whole range of targets, a life for a target lost.
const BASE_TARGET_RULES: TargetRules = {
  dial: NINE_DIAL,
  fixedDifficulty: null,
  clock: { base: 22000, ramps: 'none', playerSet: false, countsDown: true },
  spawn: { share: 1 / 3, cap: null, maxTargets: null, cadence: true, reach: null },
  scoring: { weights: { acc: 0.5, spd: 0.5 }, base: SCORE_BASE, streak: 'none' },
  lives: { count: 3, wastefulCostsLife: false, expiryCostsLife: true },
  capabilities: { scored: true, coached: false, keyHints: false },
}

// A mode's rules with a patch laid over them — one group at a time, so a patch naming
// one clock figure keeps the rest of the clock rather than replacing it wholesale.
//
// `weights` is the one pair that replaces rather than merges: the two halves of a blend
// have to add to one, and a patch that moved only `acc` would leave a mode scoring out
// of some other total.
export function patchRules(base: TargetRules, patch: RulesPatch): TargetRules {
  return {
    dial: patch.dial ?? base.dial,
    fixedDifficulty:
      patch.fixedDifficulty === undefined ? base.fixedDifficulty : patch.fixedDifficulty,
    clock: { ...base.clock, ...patch.clock },
    spawn: { ...base.spawn, ...patch.spawn },
    scoring: {
      ...base.scoring,
      ...patch.scoring,
      weights: patch.scoring?.weights ?? base.scoring.weights,
    },
    lives: { ...base.lives, ...patch.lives },
    capabilities: { ...base.capabilities, ...patch.capabilities },
  }
}

// A mode defined as a difference from the ordinary scored run.
export const targetRules = (patch: RulesPatch): TargetRules =>
  patchRules(BASE_TARGET_RULES, patch)

// Everything a live run is governed by: the mode's rules with a submode laid over them
// and a difficulty resolved into them.
//
// The engine reads this and nothing else. That is the whole point of it — every
// `mode === 'trainee'` the machine, the spawner and the game screen used to carry is one
// of these fields now, so a mode the engine has never heard of runs correctly.
export type RunRules = {
  mode: string
  dial: DialSpec
  // The rung actually in force, which is the mode's own when it fixes one.
  difficulty: Difficulty
  // Whether the player chose it. False for a mode that pins its rung — the intro hides
  // the difficulty row, and nothing keeps a per-difficulty board.
  usesDifficulty: boolean
  clock: {
    // The clock a target gets at the start of a run, difficulty already applied.
    base: number
    ramps: RampTarget
    playerSet: boolean
    countsDown: boolean
  }
  spawn: {
    share: number
    cap: number | null
    // How many targets may share the board — the difficulty's number unless the mode
    // names its own.
    maxTargets: number
    cadence: boolean
    reach: number | null
  }
  // The mode's scoring with its headline filled in, so no reader has to work out which
  // factor a mode is about.
  scoring: Required<ScoringRules>
  lives: {
    count: number
    // The accuracy a hit has to beat to not cost a life, or null in a mode where a hit
    // never costs one.
    wasteful: number | null
    expiryCosts: boolean
  }
  capabilities: Capabilities
}

// Which factor a blend favours, which is the headline unless the mode says otherwise. A
// dead heat goes to the route: it is the half of the game a player can work at.
const favoured = (weights: { acc: number; spd: number }): Headline =>
  weights.spd > weights.acc ? 'spd' : 'acc'

const livesOf = (lives: LivesRules, difficulty: Difficulty): RunRules['lives'] => ({
  count: lives.count,
  wasteful: lives.wastefulCostsLife ? DIFFICULTIES[difficulty].wastefulThreshold : null,
  expiryCosts: lives.expiryCostsLife,
})

// The rules a run is played under.
//
// `difficulty` is what the player picked; a mode that fixes its own rung ignores it, so
// the pair handed in is always the pair the intro holds and no caller has to remember
// which modes care.
export function resolveRules(
  rules: TargetRules,
  mode: string,
  difficulty: Difficulty,
  submode: Submode | null = null,
): RunRules {
  const patched = submode === null ? rules : patchRules(rules, submode.patch)
  const rung = patched.fixedDifficulty ?? difficulty
  const grade = DIFFICULTIES[rung]
  return {
    mode,
    dial: patched.dial,
    difficulty: rung,
    usesDifficulty: patched.fixedDifficulty === null,
    clock: {
      base: Math.round(patched.clock.base * grade.timeoutScale),
      ramps: patched.clock.ramps,
      playerSet: patched.clock.playerSet,
      countsDown: patched.clock.countsDown,
    },
    spawn: {
      share: patched.spawn.share,
      cap: patched.spawn.cap,
      maxTargets: patched.spawn.maxTargets ?? grade.maxTargets,
      cadence: patched.spawn.cadence,
      reach: patched.spawn.reach,
    },
    scoring: {
      ...patched.scoring,
      headline: patched.scoring.headline ?? favoured(patched.scoring.weights),
    },
    lives: livesOf(patched.lives, rung),
    capabilities: patched.capabilities,
  }
}

// The clock a target gets, given how many hits the run has landed so far. Only a run
// ramping its `clock` moves; the rest hand back the flat timeout.
export const rampedTimeout = (rules: RunRules, hits: number): number =>
  rules.clock.ramps === 'clock'
    ? Math.round(decayed(rules.clock.base, hits))
    : rules.clock.base

// How long the engine waits before dealing the next target.
//
// A share of the clock a target would get right now, capped where the mode says so, and
// never shorter than its own ramp allows.
//
// Under a `clock` ramp the share is all it takes: the gap follows the ring down, so the
// board keeps roughly the same number of targets on it all run long.
//
// Under a `spawn` ramp the clock never moves, so the same decay is applied here instead
// — every target still gets the full ring it always got, but they arrive closer and
// closer together and the board fills up. Same curve and same floor as Speed's; only
// what it squeezes is different.
export function spawnInterval(
  rules: RunRules,
  hits: number,
  // The clock a target actually gets, when that is not the one the rules would give.
  // Only a mode whose clock is the player's to set passes it — and the gap has to follow
  // it, or halving the clock would leave the board emptying out between arrivals that
  // still came at the old pace.
  timeoutMs?: number,
): number {
  const base = (timeoutMs ?? rampedTimeout(rules, hits)) * rules.spawn.share
  // The cap is checked before the ramp rather than after, and against the mode rather
  // than against whether a clock was handed in — so a mode that caps its gap answers the
  // same either way.
  if (rules.spawn.cap !== null) return Math.round(Math.min(base, rules.spawn.cap))
  return Math.round(rules.clock.ramps === 'spawn' ? decayed(base, hits) : base)
}
