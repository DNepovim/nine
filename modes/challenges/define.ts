import type { MessageDescriptor } from '@lingui/core'

import { patchRules } from '@/modes/rules'
import {
  defineMode,
  type ModeDefinition,
  type RulesPatch,
  type ShotKind,
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
  gradient?: readonly [string, string]
  darkGradient?: readonly [string, string]
  shot?: ShotKind | null
}

// What every challenge's id begins with. Namespaced so nothing that merely carries a
// mode — a stored run, a stat row, an analytics event — can confuse one for a permanent
// mode, and so an id that outlives its challenge is recognisable as the thing it was.
const PREFIX = 'challenge/'

export const challengeId = (slug: string): string => `${PREFIX}${slug}`

export function defineChallenge(spec: ChallengeSpec): ModeDefinition {
  return defineMode({
    id: challengeId(spec.slug),
    label: spec.label,
    description: spec.description,
    gradient: spec.gradient ?? spec.base.gradient,
    darkGradient: spec.darkGradient ?? spec.base.darkGradient,
    shot: spec.shot === undefined ? spec.base.shot : spec.shot,
    window: { from: spec.from, until: spec.until },
    engine: 'targets',
    rules: patchRules(spec.base.rules, spec.rules ?? {}),
  })
}

// Whether a mode is open right now. True for everything permanent — a mode with no
// window is always on the app — and true for a challenge only inside its own.
export const isOpenMode = (mode: ModeDefinition, now: number): boolean =>
  mode.window === null || (now >= mode.window.from && now < mode.window.until)
