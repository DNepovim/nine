import { challengeInk } from './challenges/palette'
import { DIFFICULTY_T, type Difficulty } from './difficulty'
import { isChallenge, modeById, type ModeId, type ScoredMode } from './registry'

// Linear interpolation between two 6-digit hex colors.
export function lerpColor(from: string, to: string, t: number): string {
  if (t <= 0) return from
  if (t >= 1) return to
  const r1 = parseInt(from.slice(1, 3), 16)
  const g1 = parseInt(from.slice(3, 5), 16)
  const b1 = parseInt(from.slice(5, 7), 16)
  const r2 = parseInt(to.slice(1, 3), 16)
  const g2 = parseInt(to.slice(3, 5), 16)
  const b2 = parseInt(to.slice(5, 7), 16)
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const b = Math.round(b1 + (b2 - b1) * t)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

// What a mode nothing is registered under is painted in — a challenge whose window
// closed, still named in a player's own history. The spectrum's middle, which is the
// least surprising thing a strip of them can hold.
const GONE_GRADIENT = ['#7273D2', '#c36282'] as const
const GONE_DARK_GRADIENT = ['#27255a', '#501b2e'] as const

// A mode's two stops, and the same pair darkened for a button background behind white
// text. Read off the mode rather than out of a table keyed by every mode there is —
// which is what makes a twentieth mode's colours part of the twentieth mode, and what
// lets a challenge have its own.
export const gradientOf = (id: ModeId): readonly [string, string] =>
  modeById(id)?.gradient ?? GONE_GRADIENT

export const darkGradientOf = (id: ModeId): readonly [string, string] =>
  modeById(id)?.darkGradient ?? GONE_DARK_GRADIENT

// Multiplayer's own two-stop gradients: a teal shared by both scored modes, standing
// for "you're in multiplayer" the way a mode's own stops stand for a single mode,
// paired with that mode's own end stop — its dominant colour carried over from
// singleplayer. Teal rather than a mode hue on purpose: the app's existing mode-switch
// flash colours (`animated-letter.tsx`) already reach into this same cyan/green family
// specifically because it is unused everywhere else, so a multiplayer room reads as its
// own thing rather than a re-skin of accuracy or speed.
export const MULTIPLAYER_GRADIENT = {
  accuracy: ['#0D9488', gradientOf('accuracy')[1]],
  speed: ['#0D9488', gradientOf('speed')[1]],
} as const satisfies Record<ScoredMode, readonly [string, string]>

// Same shape, darkened for CTA buttons — the teal darkened to match, the dominant
// stop reused from the mode's dark pair rather than re-derived.
export const DARK_MULTIPLAYER_GRADIENT = {
  accuracy: ['#0A3D37', darkGradientOf('accuracy')[1]],
  speed: ['#0A3D37', darkGradientOf('speed')[1]],
} as const satisfies Record<ScoredMode, readonly [string, string]>

// Difficulty is a position on the mode gradient: easy = start, extreme = end.
export function getDifficultyColor(id: ModeId, difficulty: Difficulty): string {
  const [start, end] = gradientOf(id)
  return lerpColor(start, end, DIFFICULTY_T[difficulty])
}

// What a run's final score is lit in, on the screens that stop a run.
//
// A board run takes its mode's own first stop, so the figure says which board it was set
// on — the same hue the selectors gave the option that was picked.
//
// A **challenge** takes its own colour too, but the shade of it that carries a word: its
// first stop is the near-black every challenge shares, which would draw the one number
// the screen is about in the colour text is drawn in — a score that looked switched off.
// `challengeInk` is that hue at a lightness which clears the bar, and the glow the
// screens derive from it comes out in the same colour.
//
// The hex rather than a token, because those screens light the digits from behind and a
// glow is a runtime value. Safe for a challenge, which reaches neither of the two screens
// that re-bind `--color-score`: both belong to board records.
export const scoreInkOf = (id: ModeId): string =>
  isChallenge(id) ? challengeInk(gradientOf(id)[1]) : gradientOf(id)[0]
