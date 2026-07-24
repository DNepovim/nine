export type Mode = 'trainee' | 'accuracy' | 'speed'

export const MODE_ORDER: Mode[] = ['trainee', 'accuracy', 'speed']

type StreakTrigger = 'optimal' | 'clear' | 'none'

export type ModeConfig = {
  label: string
  baseTimeout: number
  weights: { acc: number; spd: number }
  lives: number // Number.POSITIVE_INFINITY = no life loss (trainee)
  streak: StreakTrigger
}

export const MODES: Record<Mode, ModeConfig> = {
  trainee: {
    label: 'TRAINEE',
    baseTimeout: 22000,
    weights: { acc: 2 / 3, spd: 1 / 3 },
    lives: Number.POSITIVE_INFINITY,
    streak: 'none',
  },
  accuracy: {
    label: 'ACCURACY',
    baseTimeout: 22000,
    weights: { acc: 0.85, spd: 0.15 },
    lives: 3,
    streak: 'optimal',
  },
  speed: {
    label: 'SPEED',
    baseTimeout: 8000,
    weights: { acc: 0.15, spd: 0.85 },
    lives: 3,
    streak: 'clear',
  },
}

export type Difficulty = 'easy' | 'hard' | 'extreme'

export const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'hard', 'extreme']

export type DifficultyConfig = {
  label: string
  timeoutScale: number
  maxTargets: number
}

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  easy: { label: 'EASY', timeoutScale: 1.3, maxTargets: 3 },
  hard: { label: 'HARD', timeoutScale: 0.75, maxTargets: 3 },
  extreme: { label: 'EXTREME', timeoutScale: 0.55, maxTargets: 4 },
}

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
  trainee: 'Learn the ropes — no lives, no rush.',
  accuracy: 'Fewest moves win. Precision over speed.',
  speed: 'Race the clock. Fast hits build big combos.',
  arcade: 'Levels, bonuses, sidequests.',
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

// round(baseTimeout × timeoutScale)
export const effectiveTimeout = (mode: Mode, difficulty: Difficulty): number =>
  Math.round(MODES[mode].baseTimeout * DIFFICULTIES[difficulty].timeoutScale)

// Targets spawn every 1/3 of the target liveness timeout.
export const effectiveSpawnInterval = (mode: Mode, difficulty: Difficulty): number =>
  Math.round(effectiveTimeout(mode, difficulty) / 3)

// ×2 → ×4 → ×8 (capped). streakCount = consecutive triggers; 0 ⇒ ×1.
export const streakMultiplier = (streakCount: number): number =>
  streakCount <= 0 ? 1 : Math.min(8, 2 ** streakCount)
