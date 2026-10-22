import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'

import type { ClaimTier, TitleWords } from '@/lib/game-over-title'
import {
  challengeDarkPairFor,
  challengeHue,
  challengePairFor,
} from '@/modes/challenges/palette'
import { ACCURACY } from '@/modes/definitions/accuracy'
import { patchRules } from '@/modes/rules'
import {
  defineMode,
  type ModeDefinition,
  type RulesPatch,
  type ShotKind,
  type TargetRules,
} from '@/modes/types'

// A **challenge**: a mode that is on the app for a day.
//
// The feature this whole package was shaped for. A challenge is a mode in every sense —
// its own dial, its own clock, its own scoring, its own name on the intro — and the only
// thing unusual about it is that it exists for a window and then does not. So it is not
// a special case in the engine: `defineChallenge` turns a spec into an ordinary mode
// definition with a window on it, the registry holds it beside the permanent ones, and
// the engine never learns the difference.
//
// What a challenge may change is exactly `RulesPatch`: the dial under it (how many keys,
// what they are worth, how far a digit goes), the clock and its ramp, how many targets
// share the screen and how fast they arrive, the blend a hit is scored by, the streak
// rule, the lives. Anything a permanent mode may say about itself.

export type ChallengeSpec = {
  // A short, stable name. Prefixed on the way in, so a challenge can never collide with
  // a permanent mode's id and a stored run's mode reads as what it is.
  slug: string
  label: MessageDescriptor
  // Three letters for the rows too tight to spell the label out. Optional, and inherited
  // from the base mode like the colours below it — a challenge is a variation of
  // something, so SPD is a truthful enough short name for one built on Speed, and
  // inventing a code is work every challenge would otherwise have to do before it could
  // be written. Name one where the variation is the point.
  code?: MessageDescriptor
  description: MessageDescriptor
  // The mode this one is a variation of — its rules are the starting point, and its
  // colours are borrowed unless the spec names its own.
  base: Extract<ModeDefinition, { engine: 'targets' }>
  // When it opens and when it closes, as ms timestamps. Absolute rather than a duration
  // from first launch: every player gets the same window, which is what makes a
  // challenge board comparable at all.
  from: number
  until: number
  rules?: RulesPatch
  // A hue of its own, in degrees, where the generated one will not do — `TURQUOISE` and
  // friends in `modes/challenges/palette.ts`, which is also where the cost of leaving the
  // arc is written down.
  //
  // A hue and not a pair of hexes: the near-black every challenge shares, the two
  // saturations and the two lightnesses are the palette's, so a challenge that picks its
  // own colour is still built the same way as one that was given one. Naming hexes here
  // was how a hand-picked challenge ended up with a bright stop from one convention and
  // a CTA stop from another.
  hue?: number
  // The last resort, for a pair no single hue describes. Nothing uses it; `hue` is the
  // door, and this is the window beside it.
  gradient?: readonly [string, string]
  darkGradient?: readonly [string, string]
  // What the game-over screen says about a run of this challenge — see `claims` on
  // `ModeDefinition`. Left out by a challenge content with the app's own words.
  claims?: Partial<Record<ClaimTier, readonly TitleWords[]>>
  shot?: ShotKind | null
}

// What a challenge *is*, for the screens that have to say so beside the name of one.
//
// Here rather than in each screen because two of them need it and they must not drift:
// the pill on the pause and game-over screens, and the line under the name in the game's
// own top bar. `labelOf` answers for which challenge; this answers for what kind of
// thing it is.
//
// Upper case, as every label in this app is. The top bar lower-cases it the same way it
// lower-cases a rung, which is that screen's own voice rather than a second string.
export const CHALLENGE_WORD = msg`CHALLENGE`

// What every challenge's id begins with. Namespaced so nothing that merely carries a
// mode — a stored run, a stat row, an analytics event — can confuse one for a permanent
// mode, and so an id that outlives its challenge is recognisable as the thing it was.
const PREFIX = 'challenge/'

export const challengeId = (slug: string): string => `${PREFIX}${slug}`

// A challenge never keeps a **board** — one mode × difficulty pairing with three
// periods, a medal and a reign. Its standings belong to the session it was aired in,
// which is a different thing and a different table; and `scores.mode` carries a check
// constraint that would refuse the write in any case.
//
// Forced here rather than remembered by each spec, and forced **after** `patchRules`
// rather than before it: that merge is `{ ...base.capabilities, ...patch.capabilities }`,
// so a force applied to the base would be overwritten by any spec that mentions
// capabilities at all. The catalog's one worked example does not mention them, which is
// exactly how the wrong order would have shipped green and failed on the second
// challenge anybody wrote.
//
// `scored` is left alone and inherited — a challenge run has a score, shows it, and
// counts it. The two flags come apart precisely here.
// What a challenge is scored and spent by, unless its own spec says otherwise.
//
// Laid over the **base mode** and then under the spec's own patch, so these are defaults
// rather than forces: a challenge may still ask for a speed-heavy blend, and one that
// does is saying so on purpose. `board: false` below is the opposite — a force, applied
// after everything, because no challenge may keep a board whatever it asks for.
//
// **It counts like Accuracy.** The blend leans 85/15 towards the route and the streak is
// built by hits taken in par presses — Accuracy's counting and Accuracy's strike,
// whichever mode the challenge was built from. A challenge is a puzzle to be met once, and
// the route is the half of the game a player can work out on the day; without this, a
// challenge based on SPEED was quietly a Speed run with a different dial.
//
// **Bad accuracy costs no life.** A wasteful hit takes one in Accuracy above Easy. On a
// challenge the dial, the clock and the scoring are all strange at once and the player
// has a day to work them out; spending a life on the way to understanding the thing is a
// punishment for not already knowing it. Lives still go to an expiry, which is the clock
// doing its job rather than the rules second-guessing.
const CHALLENGE_DEFAULTS: RulesPatch = {
  scoring: { weights: ACCURACY.rules.scoring.weights, streak: 'optimal' },
  lives: { wastefulCostsLife: false },
}

const noBoard = (rules: TargetRules): TargetRules => ({
  ...rules,
  capabilities: { ...rules.capabilities, board: false },
})

// `index` is the challenge's place in the catalog, and the only reason it is a parameter
// is colour: the pair is derived from it (see `modes/challenges/palette.ts`). The catalog
// passes it by mapping over its own list, so nobody writes a number down and nobody can
// get it wrong — `[A, B].map(defineChallenge)` hands each spec its own position.
//
// Defaulted so a test, which has no catalog to be a position in, can define one in a
// line. Every such challenge is index 0 and so shares a colour, which is correct: they
// are not in the catalog together and never drawn beside each other.
export function defineChallenge(spec: ChallengeSpec, index = 0): ModeDefinition {
  return defineMode({
    id: challengeId(spec.slug),
    label: spec.label,
    code: spec.code ?? spec.base.code,
    description: spec.description,
    // **Not** the base mode's pair, which is what this did until challenges had colours
    // of their own: a challenge built on SPEED came out wearing Speed's exact gradient,
    // so the one thing on the intro that is only here today was the hardest thing on it
    // to tell apart. The pair is a near-black and a hue — the challenge's own if it named
    // one, otherwise the one its place in the catalog works out to.
    //
    // Both stops resolve from the same hue, which is the point of doing it here rather
    // than letting a spec name two hexes: a bright stop and a CTA stop that disagreed
    // about which colour the challenge is would be a card and a button from two
    // different challenges.
    gradient: spec.gradient ?? challengePairFor(spec.hue ?? challengeHue(index)),
    darkGradient:
      spec.darkGradient ?? challengeDarkPairFor(spec.hue ?? challengeHue(index)),
    shot: spec.shot === undefined ? spec.base.shot : spec.shot,
    claims: spec.claims,
    window: { from: spec.from, until: spec.until },
    engine: 'targets',
    // Three layers, and the order is the whole of their meaning: the base mode, then
    // what every challenge is unless it says otherwise, then what this one says. A spec
    // naming its own weights or streak still wins; a spec naming none counts like
    // Accuracy rather than like whichever mode it was built from.
    rules: noBoard(
      patchRules(patchRules(spec.base.rules, CHALLENGE_DEFAULTS), spec.rules ?? {}),
    ),
  })
}

// Whether a mode is open right now. True for everything permanent — a mode with no
// window is always on the app — and true for a challenge only inside its own.
export const isOpenMode = (mode: ModeDefinition, now: number): boolean =>
  mode.window === null || (now >= mode.window.from && now < mode.window.until)
