import type { MessageDescriptor } from '@lingui/core'

import type { DialSpec, Grid } from './dial'
import type { Difficulty } from './difficulty'
import type { RampTarget } from './ramp'
import type { StreakTrigger } from './streak'

// What a mode is, as data.
//
// There were three modes and a table of them, so every rule a mode could bend was a
// column in that table and every rule it could not was a branch somewhere else reading
// `mode === 'trainee'`. Those branches are what this replaces: a mode hands over a
// complete set of rules, the engine reads the rules, and nothing in the engine knows
// which modes exist. Adding the twentieth costs one file.

// Which engine runs a mode. `targets` is the game machine — a dial, targets arriving on
// a clock, a score. `arcade` is the way: one choice at a time, a depth instead of a
// score, and its own loop (hooks/use-arcade-run.ts). A mode names its engine so the
// intro can list every mode together while each still starts the run it means.
export type ModeEngine = 'targets' | 'arcade'

// When a mode exists. Null for everything permanent; a window for a **challenge**, which
// is a mode on the app for a day. See modes/challenges.
type ModeWindow = { from: number; until: number }

type ClockRules = {
  // How long a target lasts before the difficulty's scale is applied, in ms.
  base: number
  ramps: RampTarget
  // Whether the player sets the clock themselves, from the pause screen. True for
  // practice, where the clock is the one thing not being tested; false everywhere the
  // clock *is* the test.
  playerSet: boolean
  // Whether the clock runs down at all. The tutorial's does not: a target waits as long
  // as it takes, and a hit on it is scored as though no time had passed, because none
  // had.
  countsDown: boolean
}

type SpawnRules = {
  // The gap between arrivals, as a share of the clock a target gets right now. A third
  // keeps the board about as full as the clock is generous.
  share: number
  // The longest the mode ever waits between arrivals, however long its clock is set to,
  // or null for no cap. A long clock is meant to buy time on the target, not time with
  // nothing to look at.
  cap: number | null
  // How many targets may share the board, or null to take the difficulty's number.
  maxTargets: number | null
  // Whether a cadence runs at all. False in the tutorial, where the one target standing
  // is the whole board until it is hit and the respawn is what deals the next.
  cadence: boolean
  // How far a new target may land from the sum now dialled, or null for the whole range
  // the dial reaches.
  reach: number | null
}

// Which of the two factors a run reports as its headline: the figure that floats off a
// hit, and the average the run stats lead with.
export type Headline = 'acc' | 'spd'

export type ScoringRules = {
  // How the hundred points a hit is worth are blended from the two factors.
  weights: { acc: number; spd: number }
  // What a perfect hit is worth before that blend.
  base: number
  streak: StreakTrigger
  // The headline, when it is not simply the factor the blend above favours.
  //
  // Optional because that default is right for every mode there is, and a mode stating
  // it again is a second place for it to be wrong: a mode scored four-fifths on the
  // route reporting the clock would be reporting the thing it is not asking for. Set it
  // only for a mode that genuinely wants to be measured on one factor and show the
  // other.
  //
  // Read only where there is a score to read it beside — both screens that show it are
  // behind `scored` — so an unscored mode never needs to have an opinion.
  headline?: Headline
}

export type LivesRules = {
  // Number.POSITIVE_INFINITY = no life loss.
  count: number
  // Whether a hit scoring under the difficulty's bar costs a life.
  wastefulCostsLife: boolean
  // Whether a target running out costs one.
  expiryCostsLife: boolean
}

// What a mode is *shown as*, rather than what it is scored by. Each one replaces a
// `mode === …` check that used to live in the screen it affected.
export type Capabilities = {
  // Keeps a board: a leaderboard, a rank, a medal, a personal best, a submitted score.
  // Every board-shaped question in the app is really this flag.
  scored: boolean
  // Teaches. The stat block under the dial, the coach's debrief after a wasteful hit,
  // the clean-hit celebration, the nudge up a rung.
  coached: boolean
  // The dial may print what a key is worth and what it is giving right now.
  keyHints: boolean
}

// Everything the game machine needs to run a mode, before a difficulty is chosen.
export type TargetRules = {
  dial: DialSpec
  // The one rung this mode is always played on, or null to let the player pick. A mode
  // with a fixed rung shows no difficulty row and keeps no per-difficulty board.
  fixedDifficulty: Difficulty | null
  clock: ClockRules
  spawn: SpawnRules
  scoring: ScoringRules
  lives: LivesRules
  capabilities: Capabilities
}

// A change to a mode's rules, laid over the mode it is based on.
//
// Two things need one. A **submode** — the tutorial — is a mode with some of its rules
// taken off, and a **challenge** is a mode with some of them replaced. Both are the same
// operation, so both use this and `patchRules` applies it.
export type RulesPatch = {
  dial?: DialSpec
  fixedDifficulty?: Difficulty | null
  clock?: Partial<ClockRules>
  spawn?: Partial<SpawnRules>
  scoring?: Partial<Omit<ScoringRules, 'weights'>> & {
    weights?: { acc: number; spd: number }
  }
  lives?: Partial<LivesRules>
  capabilities?: Partial<Capabilities>
}

// A run of a mode with some of its rules changed, under a name of its own.
//
// The tutorial is the only one today: Trainee with the clock, the cadence and the
// options taken off, called TUTORIAL on screen. It is a submode rather than a mode
// because everything else about it is Trainee, down to the colour — so it never appears
// on the intro and never keeps a board of its own.
export type Submode = {
  id: string
  label: MessageDescriptor
  patch: RulesPatch
  // The dial position a run of it opens on, with `target` already standing there, or null to
  // open on an empty dial for the spawner to fill. A lesson needs one: a dial of zeros
  // is the one position where every key looks alike and nothing on it has happened yet,
  // so there is nothing to point at.
  opening: { grid: Grid; target: number } | null
  // The targets a run of it deals itself, by how many have gone down so far, or null
  // once the script has run out and the spawner takes over. Null throughout for a
  // submode that deals none.
  //
  // The engine asks the submode rather than asking whether it is the tutorial, which is
  // what it used to do — a scripted opening and a scripted run are things a submode may
  // have, not things the tutorial is.
  script: ((hits: number) => number | null) | null
}

// What a strike fires. Each scored mode gets the shot its streak is made of: a chain of
// exact presses draws a single held beam, a run of fast ones empties a magazine. Null for
// a mode whose streak is not a chain of decisions at all.
//
// On the mode rather than in a table beside the drawing, so a challenge inherits the shot
// of the mode it is based on and a new mode brings its own.
export type ShotKind = 'sniper' | 'burst'

// What every mode says about itself, whichever engine runs it.
type ModeIdentity = {
  id: string
  label: MessageDescriptor
  // One line, under the pills on the intro. The pill above already names the mode, so
  // this says what a run of it asks rather than naming it again.
  description: MessageDescriptor
  // Two stops. Each playable mode's end equals the next mode's start, forming a
  // continuous blue → purple → pink → red → amber spectrum across the intro.
  gradient: readonly [string, string]
  // The same hues darkened, for use as a high-contrast button background behind white
  // text.
  darkGradient: readonly [string, string]
  shot: ShotKind | null
  window: ModeWindow | null
}

export type ModeDefinition = ModeIdentity &
  ({ engine: 'targets'; rules: TargetRules } | { engine: 'arcade' })

// Keeps each definition's `id` a literal rather than widening it to `string`, which is
// what gives `Mode` its union — see modes/registry.ts.
export const defineMode = <const T extends ModeDefinition>(mode: T): T => mode
