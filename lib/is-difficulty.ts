import { DIFFICULTY_ORDER, type Difficulty } from '@/machines/game'

export const isDifficulty = (value: string): value is Difficulty =>
  DIFFICULTY_ORDER.some((difficulty) => difficulty === value)
