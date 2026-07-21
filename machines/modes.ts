import { SPECTRUM } from '@/constants/colors'

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

export type Difficulty = 'easy' | 'medium' | 'hard' | 'extreme'

export const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'medium', 'hard', 'extreme']

export type DifficultyConfig = {
  label: string
  timeoutScale: number
  maxTargets: number
  spawnInterval: number
}

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  easy: { label: 'EASY', timeoutScale: 1.3, maxTargets: 1, spawnInterval: 6000 },
  medium: { label: 'MEDIUM', timeoutScale: 1.0, maxTargets: 2, spawnInterval: 5000 },
  hard: { label: 'HARD', timeoutScale: 0.75, maxTargets: 3, spawnInterval: 3500 },
  extreme: { label: 'EXTREME', timeoutScale: 0.55, maxTargets: 4, spawnInterval: 2500 },
}

export const MODE_COLORS: Record<Mode, string> = {
  trainee: SPECTRUM[0],
  accuracy: SPECTRUM[1],
  speed: SPECTRUM[4],
}

export const MODE_DESCRIPTIONS: Record<Mode, string> = {
  trainee: 'Learn the ropes — no lives, no rush.',
  accuracy: 'Fewest moves win. Precision over speed.',
  speed: 'Race the clock. Fast hits build big combos.',
}

export const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: SPECTRUM[0],
  medium: SPECTRUM[1],
  hard: SPECTRUM[3],
  extreme: SPECTRUM[4],
}

// Locked, UI-only teaser — NOT a playable Mode yet.
export const ARCADE_TEASER = {
  label: 'ARCADE',
  color: SPECTRUM[2],
  description: 'Levels, bonuses, sidequests.',
  tag: 'SOON',
} as const

// round(baseTimeout × timeoutScale)
export const effectiveTimeout = (mode: Mode, difficulty: Difficulty): number =>
  Math.round(MODES[mode].baseTimeout * DIFFICULTIES[difficulty].timeoutScale)

// ×2 → ×4 → ×8 (capped). streakCount = consecutive triggers; 0 ⇒ ×1.
export const streakMultiplier = (streakCount: number): number =>
  streakCount <= 0 ? 1 : Math.min(8, 2 ** streakCount)
