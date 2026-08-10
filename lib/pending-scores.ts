import AsyncStorage from '@react-native-async-storage/async-storage'
import { isEmptyArray } from 'narrowland'

import { PENDING_SCORES_KEY } from '@/constants/storage'
import { qualifiesForTab, type LeaderboardTab } from '@/lib/leaderboard-period'
import type { Difficulty, Mode } from '@/machines/game'

// A run that could not be published: the player has no nickname yet, or the upsert
// failed. The queue is drained by flushPendingScores once publishing is possible.
export type PendingScore = {
  mode: Mode
  difficulty: Difficulty
  score: number
  hits: number
  day: string // 'YYYY-MM-DD'
}

export async function readPendingScores(): Promise<PendingScore[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_SCORES_KEY)
    return raw ? (JSON.parse(raw) as PendingScore[]) : []
  } catch {
    return []
  }
}

export async function writePendingScores(queue: PendingScore[]): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_SCORES_KEY, JSON.stringify(queue))
  } catch {
    // ignore — the queue is best-effort
  }
}

// The best unpublished score for one board inside a period, or null when the player
// has nothing waiting there.
export function bestPendingScore(
  queue: PendingScore[],
  mode: Mode,
  difficulty: Difficulty,
  tab: LeaderboardTab,
  today: string,
): number | null {
  const scores = queue
    .filter(
      (entry) =>
        entry.mode === mode &&
        entry.difficulty === difficulty &&
        qualifiesForTab(entry.day, tab, today),
    )
    .map((entry) => entry.score)
  return isEmptyArray(scores) ? null : Math.max(...scores)
}
