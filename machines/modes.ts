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
  // Whether the target clock tightens as the run goes on. See rampedTimeout.
  ramps: boolean
}

export const MODES: Record<Mode, ModeConfig> = {
  trainee: {
    label: 'TRAINEE',
    baseTimeout: 22000,
    weights: { acc: 2 / 3, spd: 1 / 3 },
    lives: Number.POSITIVE_INFINITY,
    streak: 'none',
    ramps: false,
  },
  accuracy: {
    label: 'ACCURACY',
    baseTimeout: 22000,
    weights: { acc: 0.85, spd: 0.15 },
    lives: 3,
    streak: 'optimal',
    ramps: false,
  },
  speed: {
    label: 'SPEED',
    // Accuracy's 22 000 / 1.5 — Speed runs half again as fast, not nearly three
    // times, which was more punishing than distinguishing.
    baseTimeout: 14667,
    weights: { acc: 0.15, spd: 0.85 },
    lives: 3,
    streak: 'fast',
    ramps: true,
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

// The clock a target gets, given how many hits the run has landed so far.
//
// Exponential decay towards a floor: each RAMP_HALF_LIFE_HITS hits removes half of
// whatever slack is left. That makes the contraction decelerate — the first twenty
// hits cost far more time than the next twenty, and the curve never reaches the floor
// at all, so the run tightens without ever becoming impossible.
//
// Only Speed ramps. Accuracy is about deliberation, and squeezing its clock as the run
// went on would undermine the thing it asks of the player.
export function rampedTimeout(mode: Mode, difficulty: Difficulty, hits: number): number {
  const base = effectiveTimeout(mode, difficulty)
  if (!MODES[mode].ramps) return base
  const floor = base * RAMP_FLOOR_RATIO
  const remaining = 0.5 ** (Math.max(0, hits) / RAMP_HALF_LIFE_HITS)
  return Math.round(floor + (base - floor) * remaining)
}

// Targets spawn every 1/3 of the timeout a target would get right now, so the gap
// between arrivals tightens with the clock and the board keeps roughly the same
// number of targets on it all run long.
export const effectiveSpawnInterval = (
  mode: Mode,
  difficulty: Difficulty,
  hits: number,
): number => Math.round(rampedTimeout(mode, difficulty, hits) / 3)

// ×2 → ×4 → ×8 (capped). streakCount = consecutive triggers; 0 ⇒ ×1.
export const streakMultiplier = (streakCount: number): number =>
  streakCount <= 0 ? 1 : Math.min(8, 2 ** streakCount)
