export type Mode = 'trainee' | 'accuracy' | 'speed'

export const MODE_ORDER: Mode[] = ['trainee', 'accuracy', 'speed']

// What extends a mode's streak. `optimal` and `fast` are chains of decisions — every
// matching hit either builds them or breaks them — where `clear` depends on the spawn
// timing cooperating, so most hits leave it untouched.
export type StreakTrigger = 'optimal' | 'fast' | 'clear' | 'none'

// A hit counts as fast when this much of the target's ring is still full.
export const FAST_HIT_THRESHOLD = 0.6

export type ModeConfig = {
  label: string
  baseTimeout: number
  weights: { acc: number; spd: number }
  lives: number // Number.POSITIVE_INFINITY = no life loss (trainee)
  streak: StreakTrigger
  // What tightens as the run goes on. See rampedTimeout and effectiveSpawnInterval.
  ramps: RampTarget
}

// Where a mode's difficulty ramp lands. `clock` shortens the ring each target gets,
// `spawn` shortens the gap between arrivals, `none` holds the run at one pace.
//
// One or the other, never both. Speed squeezes the clock, and its spawn gap follows the
// clock so the board stays about as full. Accuracy's clock has to stay where it is —
// deliberation is the thing it asks for, and hurrying it would undo that — so its run
// tightens by targets arriving closer together instead.
type RampTarget = 'clock' | 'spawn' | 'none'

export const MODES: Record<Mode, ModeConfig> = {
  trainee: {
    label: 'TRAINEE',
    baseTimeout: 22000,
    weights: { acc: 2 / 3, spd: 1 / 3 },
    lives: Number.POSITIVE_INFINITY,
    streak: 'none',
    ramps: 'none',
  },
  accuracy: {
    label: 'ACCURACY',
    baseTimeout: 22000,
    weights: { acc: 0.85, spd: 0.15 },
    lives: 3,
    streak: 'optimal',
    ramps: 'spawn',
  },
  speed: {
    label: 'SPEED',
    // Accuracy's 22 000 / 1.5 — Speed runs half again as fast, not nearly three
    // times, which was more punishing than distinguishing.
    baseTimeout: 14667,
    weights: { acc: 0.15, spd: 0.85 },
    lives: 3,
    streak: 'fast',
    ramps: 'clock',
  },
}

export type Difficulty = 'easy' | 'hard' | 'extreme'

export const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'hard', 'extreme']

export type DifficultyConfig = {
  label: string
  // The label at a glance, for rows too tight to spell it out — the medal line under
  // the title. Lives beside the label so the two cannot drift.
  code: string
  timeoutScale: number
  maxTargets: number
}

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  easy: { label: 'EASY', code: 'ESY', timeoutScale: 1.3, maxTargets: 3 },
  hard: { label: 'HARD', code: 'HRD', timeoutScale: 0.75, maxTargets: 3 },
  extreme: { label: 'EXTREME', code: 'EXT', timeoutScale: 0.55, maxTargets: 4 },
}

// The modes that keep a board. Trainee is unscored, so it has no leaderboard, no rank
// and no medal — every board-shaped question in the app is really about these two.
export const SCORED_MODES = ['accuracy', 'speed'] as const satisfies readonly Mode[]
export type ScoredMode = (typeof SCORED_MODES)[number]

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

// Two-stop gradients. Each playable mode's end equals the next mode's start,
// forming a continuous blue → purple → pink → red → amber spectrum.
export const MODE_GRADIENT = {
  trainee: ['#4C7EFF', '#7273D2'] as const,
  accuracy: ['#7273D2', '#c36282'] as const,
  speed: ['#c36282', '#E5534B'] as const,
  arcade: ['#E5534B', '#FF8C00'] as const,
} as const satisfies Record<Mode | 'arcade', readonly [string, string]>

// Same hues darkened for use as a high-contrast button background behind white text.
export const DARK_MODE_GRADIENT = {
  trainee: ['#102972', '#27255a'] as const,
  accuracy: ['#27255a', '#501b2e'] as const,
  speed: ['#501b2e', '#620b0c'] as const,
  arcade: ['#620b0c', '#7A3800'] as const,
} as const satisfies Record<Mode | 'arcade', readonly [string, string]>

// Multiplayer's own two-stop gradients: a teal shared by both scored modes, standing
// for "you're in multiplayer" the way MODE_GRADIENT's own stops stand for a single
// mode, paired with that mode's own end stop from MODE_GRADIENT — its dominant colour
// carried over from singleplayer. Teal rather than a mode hue on purpose: the app's
// existing mode-switch flash colours (`animated-letter.tsx`) already reach into this
// same cyan/green family specifically because it is unused everywhere else, so a
// multiplayer room reads as its own thing rather than a re-skin of accuracy or speed.
export const MULTIPLAYER_GRADIENT = {
  accuracy: ['#0D9488', MODE_GRADIENT.accuracy[1]],
  speed: ['#0D9488', MODE_GRADIENT.speed[1]],
} as const satisfies Record<ScoredMode, readonly [string, string]>

// Same shape, darkened for CTA buttons — the teal darkened to match, the dominant
// stop reused from DARK_MODE_GRADIENT rather than re-derived.
export const DARK_MULTIPLAYER_GRADIENT = {
  accuracy: ['#0A3D37', DARK_MODE_GRADIENT.accuracy[1]],
  speed: ['#0A3D37', DARK_MODE_GRADIENT.speed[1]],
} as const satisfies Record<ScoredMode, readonly [string, string]>

export const MODE_DESCRIPTIONS: Record<Mode | 'arcade', string> = {
  trainee: `Learn the ropes.
No lives, no rush.`,
  accuracy: `Fewest moves win. 
Precision over speed.`,
  speed: `Race the clock. 
Fast hits build big combos.`,
  arcade: `New adventure.
Levels, bonuses, sidequests.`,
}

// Difficulty is a position on the mode gradient: easy = start, extreme = end.
const DIFFICULTY_T: Record<Difficulty, number> = {
  easy: 0,
  hard: 0.5,
  extreme: 1,
}

export function getDifficultyColor(mode: Mode, difficulty: Difficulty): string {
  const [start, end] = MODE_GRADIENT[mode]
  return lerpColor(start, end, DIFFICULTY_T[difficulty])
}

// Locked, UI-only teaser — NOT a playable Mode yet.
export const ARCADE_TEASER = {
  label: 'ARCADE',
  tag: 'SOON',
} as const

// round(baseTimeout × timeoutScale). Trainee has no difficulty selector, so it
// always runs at the Easy pace — its targets last as long as Accuracy on Easy.
export const effectiveTimeout = (mode: Mode, difficulty: Difficulty): number => {
  const scale = DIFFICULTIES[mode === 'trainee' ? 'easy' : difficulty].timeoutScale
  return Math.round(MODES[mode].baseTimeout * scale)
}

// How many hits close half the remaining gap to the floor, and how far down that
// floor sits relative to the run's starting timeout.
const RAMP_HALF_LIFE_HITS = 20
const RAMP_FLOOR_RATIO = 0.65

// The ramp itself, shared by both things that tighten.
//
// Exponential decay towards a floor: each RAMP_HALF_LIFE_HITS hits removes half of
// whatever slack is left. That makes the contraction decelerate — the first twenty
// hits cost far more than the next twenty, and the curve never reaches the floor at
// all, so a run tightens without ever becoming impossible.
const decayed = (base: number, hits: number): number => {
  const floor = base * RAMP_FLOOR_RATIO
  const remaining = 0.5 ** (Math.max(0, hits) / RAMP_HALF_LIFE_HITS)
  return floor + (base - floor) * remaining
}

// The clock a target gets, given how many hits the run has landed so far. Only a mode
// ramping its `clock` moves; the rest hand back the flat timeout.
export function rampedTimeout(mode: Mode, difficulty: Difficulty, hits: number): number {
  const base = effectiveTimeout(mode, difficulty)
  return MODES[mode].ramps === 'clock' ? Math.round(decayed(base, hits)) : base
}

// Targets spawn every 1/3 of the clock a target would get right now.
//
// Under a `clock` ramp that is all it takes: the gap follows the ring down, so the
// board keeps roughly the same number of targets on it all run long.
//
// Under a `spawn` ramp the clock never moves, so the same decay is applied here
// instead — every target still gets the full ring it always got, but they arrive closer
// and closer together and the board fills up. Same curve and same floor as Speed's;
// only what it squeezes is different.
export const effectiveSpawnInterval = (
  mode: Mode,
  difficulty: Difficulty,
  hits: number,
): number => {
  const base = rampedTimeout(mode, difficulty, hits) / 3
  return Math.round(MODES[mode].ramps === 'spawn' ? decayed(base, hits) : base)
}

// ×2 → ×4 → ×8 (capped). streakCount = consecutive triggers; 0 ⇒ ×1.
export const streakMultiplier = (streakCount: number): number =>
  streakCount <= 0 ? 1 : Math.min(8, 2 ** streakCount)
