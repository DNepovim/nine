import type { MessageDescriptor } from '@lingui/core'
import { isOneOf } from 'narrowland'

import type { ClaimTier, TitleWords } from '@/lib/game-over-title'

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
  // How many targets this mode's run deals from its session's own **drill**, or null to
  // roll each one as it arrives.
  //
  // A drill is the fixed list a session deals — the same values, in the same order, in
  // the same places, for every player and every run of that session. It is derived from
  // the session's id, so there is nothing to store and a rerun of the same challenge is
  // a different drill. See lib/drill.ts.
  //
  // It is also what ends the run: a drilled run is over when its drill is spent and the
  // board is clear, where every other mode plays until its lives are.
  drill: number | null
  // How long a target's number shows once its card has come in, in ms, before it fades
  // out — or null for a number that stays for the card's whole life.
  //
  // The **glimpse**. Here rather than in a group of its own because it is part of how a
  // target arrives: seen once, then held in the player's head while the route is planned.
  // It stops while the run is paused, as the ring does. The number comes back the moment
  // the card starts to leave — hit, lost, or swept off at the end of the run — so the exit
  // still shows what it was.
  //
  // What stays is the disc's band tint, though only as much of it as the ring leaves
  // uncovered: a sliver when the target arrives, growing as the clock runs down.
  //
  // Drawing only. The machine deals, hits and expires a target exactly as it always has,
  // and the rung does not scale it — the figure here is the figure on screen.
  glimpse: number | null
  // How often a standing target's number moves by one, in ms — or null for numbers that
  // hold still, which is every mode but DRIFT.
  //
  // The **drift**. This half says how often; the target's own `drift` says which way, and
  // is fixed when it is dealt. A target's number at a moment is `driftedValue`
  // (lib/target-drift.ts), and that is what the hit, the card and the spawner all read.
  // Not scaled by the rung, like the glimpse: the figure here is the step on screen.
  drift: number | null
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

  // What this mode's **session board** is ordered by, and so what its places are settled
  // on: the score everywhere but a race, where it is the clock, and a survival run, where
  // it is how many targets were taken before the run ended.
  //
  // Not the **headline** beside it, and the two must not be confused. A headline is
  // which of the two *factors* a run reports — how close to the route, or how much of
  // the ring was left. A measure is which *figure of a finished run* the standings
  // compare.
  //
  // A **board** — the mode × difficulty kind, with its periods and its reign — has no
  // measure and never will: it is always its score, and `scores` has no other column to
  // be ordered by. This is a session board's word alone, which is why it is read by the
  // planner rather than by the engine: a session is stamped with its challenge's measure
  // when it is booked, and the server orders by the stamp.
  measure: Measure
}

// The figures of a finished run a session board can be ordered by. Bounded on purpose:
// three values a reader can hold in their head, each a column `session_scores` already
// keeps, and the server's `challenge_sessions_measure` check names the same three.
//
// `hits` breaks a tie on the score, so two runs that lasted as long are told apart by
// how well each was played — the score carries the route and the clock both.
export const MEASURES = ['score', 'time', 'hits'] as const
export type Measure = (typeof MEASURES)[number]

// A measure as the server sends it, narrowed. The server stamps the measure on a session
// when it is booked and this build may not know every one a later build will: read as
// the score, which is what every screen drew for a measure it had no column for before
// the tables keyed by it existed — and what a table indexed by an unknown key would
// otherwise crash on.
export const measureFrom = (wire: string): Measure =>
  isOneOf(wire, MEASURES) ? wire : 'score'

export type LivesRules = {
  // Number.POSITIVE_INFINITY = no life loss.
  count: number
  // Whether a hit scoring under the difficulty's bar costs a life.
  wastefulCostsLife: boolean
  // Whether a target running out costs one.
  expiryCostsLife: boolean
  // The accuracy a hit has to reach to keep its life, where the mode names its own
  // rather than taking the rung's `wastefulThreshold`. Read only where
  // `wastefulCostsLife` is on — a bar on a mode that does not spend lives that way would
  // otherwise be a second switch for the same thing.
  //
  // Not called a threshold, because that word is the **difficulty**'s and this is the
  // mode overruling it: NO SLIP plays on Easy, whose rung has no bar at all, and asks
  // for 1 — the exact route, which `accuracyFactor` returns only at par.
  bar?: number
  // Whether a hit under the bar takes every heart left rather than one. Read only where
  // `wastefulCostsLife` is on, like `bar`. NO SLIP's: a run there has its hearts for the
  // clock — a target lost costs one, as anywhere — and none to spare for a slip, which
  // ends the run however many are left.
  wastefulTakesAll?: boolean
}

// What a mode is *shown as*, rather than what it is scored by. Each one replaces a
// `mode === …` check that used to live in the screen it affected.
export type Capabilities = {
  // Keeps a **board**: one mode × difficulty pairing with its three periods, a rank, a
  // medal, a reign, a personal best and a published score. Every board-shaped question
  // in the app is really this flag.
  //
  // False for a challenge, forced by `defineChallenge` — a challenge has standings, but
  // they belong to the session it was aired in rather than to a mode × difficulty, and
  // `scores.mode` would refuse the write anyway.
  board: boolean
  // Has a score worth showing and counting: the readout on the game screen, the pause
  // screen's figure, RESTART RUN, the factor in the run stats, the poor-run streak.
  //
  // Narrower than it used to be. This flag meant *board* until challenges needed both
  // answers at once — a run that is scored and keeps no board — so the board half moved
  // up to the field above and this kept the name and the smaller job. True for a
  // challenge; false only where there is no score at all, which is practice.
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
// exact presses draws a single held beam, a run of fast ones empties a magazine, and a
// route through every key on the dial sets every key alight. Null for a mode whose
// streak is not a chain of decisions at all.
//
// `flame` is the one that is not a line: it burns under the dial rather than crossing
// the board, so the shot layer never sees it — see `useStrikeShots` and `DialFlames`. It
// was a beam from each key to the card, which on a small dial was a tangle of lines
// across the very keys the streak is about.
//
// On the mode rather than in a table beside the drawing, so a challenge inherits the shot
// of the mode it is based on and a new mode brings its own.
// `chain` is the drilled run's: the beam runs from the target taken *before* this one to
// the one just taken, so a run of exact presses draws the route through the board in the
// order the player walked it. The first hit of a run has no previous target and fires
// from the sum row, as the two above always do.
export type ShotKind = 'sniper' | 'burst' | 'flame' | 'chain'

// What every mode says about itself, whichever engine runs it.
type ModeIdentity = {
  id: string
  label: MessageDescriptor
  // The label at a glance, for rows too tight to spell it out — a board code on a
  // profile, an achievement stage beside its bar. Beside the label for the same reason
  // `DifficultyConfig` keeps its own `code` there: the two are one fact about the mode,
  // and a short name kept anywhere else is a short name that drifts from the long one.
  //
  // Three letters in every locale that has one, since what it buys is a column narrow
  // enough to sit beside two others on a 320pt phone.
  code: MessageDescriptor
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
  // What the game-over screen claims about a run of this mode, for the outcomes this
  // mode names. Undefined on every permanent mode: the pools in `lib/game-over-title.ts`
  // are the app's own voice about its own boards, which is exactly right for them.
  //
  // A **challenge** is neither the app's board nor a mode a player knows, so it may say
  // its own thing — and it reaches tiers the permanent modes do differently, through its
  // session standing rather than through a board. A tier it does not name falls through
  // to the app's pool.
  claims?: Partial<Record<ClaimTier, readonly TitleWords[]>>
  window: ModeWindow | null
}

export type ModeDefinition = ModeIdentity &
  ({ engine: 'targets'; rules: TargetRules } | { engine: 'arcade' })

// Keeps each definition's `id` a literal rather than widening it to `string`, which is
// what gives `Mode` its union — see modes/registry.ts.
export const defineMode = <const T extends ModeDefinition>(mode: T): T => mode
