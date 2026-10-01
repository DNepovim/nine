import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'

import { CHALLENGES } from './challenges/catalog'
import { isOpenMode } from './challenges/define'
import { ACCURACY } from './definitions/accuracy'
import { ARCADE } from './definitions/arcade'
import { SPEED } from './definitions/speed'
import { TRAINEE } from './definitions/trainee'
import { TUTORIAL } from './definitions/tutorial'
import type { Difficulty } from './difficulty'
import { resolveRules, type RunRules } from './rules'
import type { Capabilities, Headline, ModeDefinition, ModeEngine, Submode } from './types'

// Every mode the app knows, and the one place that knows how many there are.
//
// A registry rather than a table keyed by a union, because the union was the ceiling: a
// `Record<Mode, …>` has to be edited for every mode added, and a **challenge** — a mode
// on the app for a day — cannot be in a union written at build time at all. So a mode is
// a value registered here, and everything that used to index a table now asks the
// registry.

// The modes the game machine runs, in the order the intro lists them. A tuple rather
// than an array so `Mode` stays a union of exactly these ids.
const TARGET_MODES = [TRAINEE, ACCURACY, SPEED] as const

// A mode of the game machine. Still a union, and still exhaustive over the permanent
// ones — the tables that genuinely are per-mode (an icon each, a shot each, which mode
// the game-over screen dares you into) keep their exhaustiveness, and adding a slice to
// the tuple above is what tells them to.
export type Mode = (typeof TARGET_MODES)[number]['id']

export const MODE_ORDER: Mode[] = TARGET_MODES.map((mode) => mode.id)

// Any mode at all, by name — including arcade, which is on another engine, and a
// challenge, whose id nobody wrote down at build time. Anything that merely *carries* a
// mode (a stored run, a stat row, an analytics event) takes this; anything that has to
// have an answer for each of them takes `Mode`.
//
// A union of the names this build knows with "any other string", rather than plain
// `string`: a challenge's id has to fit, and an editor should still offer the four names
// that are always there when one is being typed out.
export type ModeId = PermanentModeId | (string & NonNullable<unknown>)

// The modes that keep a board. Trainee is unscored, so it has no leaderboard, no rank
// and no medal — every board-shaped question in the app is really about these two.
//
// Written out rather than filtered off `capabilities.scored`, because a filter produces
// an array and this has to produce a type. A test holds the two to each other, so a mode
// whose capability says one thing and whose membership here says another fails.
export const SCORED_MODES = ['accuracy', 'speed'] as const satisfies readonly Mode[]
export type ScoredMode = (typeof SCORED_MODES)[number]

// Every permanent mode, whichever engine runs it.
const PERMANENT = [...TARGET_MODES, ARCADE] as const

// A mode that is always on the app — what `ModeId` lists by name before widening to any
// string, so an editor offers the four that are always there.
type PermanentModeId = (typeof PERMANENT)[number]['id']

const REGISTRY: ReadonlyMap<ModeId, ModeDefinition> = new Map(
  [...PERMANENT, ...CHALLENGES].map((mode) => [mode.id, mode]),
)

// A mode by name, or null for a name nothing is registered under — a challenge that has
// since been taken down, a stored id from a build that had a mode this one does not.
// Null rather than a throw: a name that has gone is a thing that happens to a player,
// and what should happen to them is landing on the intro.
export const modeById = (id: ModeId): ModeDefinition | null => REGISTRY.get(id) ?? null

// Every mode registered, permanent and challenge alike — what a screen that lists modes
// walks. Challenges come last, which is where a thing that is only here today belongs.
export const allModes = (): readonly ModeDefinition[] => [...REGISTRY.values()]

export const isMode = (value: string): value is Mode =>
  MODE_ORDER.some((mode) => mode === value)

// Whether a name is registered at all. What a stored mode is checked with before a run
// is put back on it.
export const isModeId = (value: string): value is ModeId => REGISTRY.has(value)

// The rules a run of this mode is played under. The engine's one question about a mode,
// and the only one it asks.
//
// A mode on another engine answers null: there are no targets, no clock and no lives to
// resolve, and a caller that got rules back for one would be about to run the wrong
// loop.
export function rulesFor(
  id: ModeId,
  difficulty: Difficulty,
  submode: Submode | null = null,
): RunRules | null {
  const mode = modeById(id)
  if (mode?.engine !== 'targets') return null
  return resolveRules(mode.rules, mode.id, difficulty, submode)
}

// Every mode open right now, in registry order — the intro's pills. Permanent modes
// always; a challenge only inside its window.
export const openModes = (now: number): readonly ModeDefinition[] =>
  allModes().filter((mode) => isOpenMode(mode, now))

// What a run is called on screen: the submode's own name when it has one, the mode's
// otherwise.
//
// One function rather than a check at each screen, because there are two screens showing
// this and a third would have had to be told: the game screen's top bar and the badge on
// the pause screen under it. Anything naming a *board* uses `labelOf` instead — a
// leaderboard, a medal, a challenge — since none of those is ever a submode.
export const runLabel = (id: ModeId, submode: Submode | null): MessageDescriptor =>
  submode?.label ?? labelOf(id)

// What to call a mode nothing is registered under — a challenge whose window closed long
// enough ago that it has been taken out of the catalog. Reachable only from a player's
// own history, which is the one place a name can outlive the thing it named.
const GONE_LABEL = msg`GAME`

export const labelOf = (id: ModeId): MessageDescriptor =>
  modeById(id)?.label ?? GONE_LABEL

// What kind of mode this is, for the screens and stores that have to ask.
//
// Every `mode === 'trainee'` outside the engine is one of these fields: the best-scores
// strip asks `scored`, the coach asks `coached`, the dial asks `keyHints`, the career
// asks `usesDifficulty`. A name nothing is registered under answers no to all of them,
// which is the safe answer in each case — nothing is shown, nothing is recorded.
export type ModeTraits = Capabilities & {
  usesDifficulty: boolean
  engine: ModeEngine | null
}

const NO_TRAITS: ModeTraits = {
  scored: false,
  coached: false,
  keyHints: false,
  usesDifficulty: false,
  engine: null,
}

export function traitsOf(id: ModeId): ModeTraits {
  const mode = modeById(id)
  if (mode === null) return NO_TRAITS
  if (mode.engine !== 'targets') return { ...NO_TRAITS, engine: mode.engine }
  return {
    ...mode.rules.capabilities,
    usesDifficulty: mode.rules.fixedDifficulty === null,
    engine: 'targets',
  }
}

export const descriptionOf = (id: ModeId): MessageDescriptor =>
  modeById(id)?.description ?? GONE_LABEL

// The clock a target gets at the start of a run of this mode, difficulty applied — what
// the slider on the pause screen takes its bounds from, and the figure a mode's own entry
// in the guide quotes. Zero for a mode with no targets at all.
export const baseClockMs = (id: ModeId, difficulty: Difficulty): number =>
  rulesFor(id, difficulty)?.clock.base ?? 0

// Which of the two factors a mode reports as its headline — the figure that floats off a
// hit, and the average its run stats lead with. The one the mode is about.
//
// Does not depend on the rung, so a reader with no difficulty in hand can still ask.
export const headlineOf = (id: ModeId): Headline =>
  rulesFor(id, 'hard')?.scoring.headline ?? 'acc'

// How many lives a run of this mode starts with — `Number.POSITIVE_INFINITY` in a mode
// that spends none. Three is the fallback for a mode nothing is registered under, which
// is what every scored mode has always started on.
export const startingLives = (id: ModeId, difficulty: Difficulty): number =>
  rulesFor(id, difficulty)?.lives.count ?? 3

// The submode a run is in, from the flag the machine carries.
//
// One submode today, and the machine's context says whether a run is it with a boolean —
// see `tutorial` in machines/game.ts. This is the one place that boolean becomes a
// submode, so a second submode is a change here and nowhere else.
export const runSubmode = (tutorial: boolean): Submode | null =>
  tutorial ? TUTORIAL : null

// The rules a run is played under, always answering.
//
// What every screen and every hook reads. `rulesFor` can answer null — a mode on another
// engine, a name nothing is registered under — and most callers have no sensible way to
// draw nothing, so this falls back to the ordinary scored run instead. Reachable only
// for a challenge whose window closed while a run of it was in progress, or a stored id
// from a build that had a mode this one does not; both land the player on a playable run
// rather than on a blank screen.
export function runRules(id: ModeId, difficulty: Difficulty, tutorial = false): RunRules {
  const submode = runSubmode(tutorial)
  const rules = rulesFor(id, difficulty, submode)
  if (rules !== null) return rules
  const fallback = rulesFor(FALLBACK_MODE, difficulty, submode)
  // Unreachable: the fallback is one of the modes this file's own tuple is built from.
  if (fallback === null) throw new Error('no rules for the fallback mode')
  return fallback
}

// Where a run lands when its own mode cannot be resolved. Accuracy is the game at rest,
// and the mode a fresh install opens on.
const FALLBACK_MODE: Mode = 'accuracy'
