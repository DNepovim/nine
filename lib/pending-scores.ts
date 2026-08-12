import AsyncStorage from '@react-native-async-storage/async-storage'
import { isEmptyArray } from 'narrowland'

import { PENDING_SCORES_KEY } from '@/constants/storage'
import { qualifiesForTab, type LeaderboardTab } from '@/lib/leaderboard-period'
import type { Difficulty, Mode } from '@/machines/game'

// A record that has not reached the server: the player has no nickname yet, or the
// upsert failed — offline being the usual reason. The queue is drained by
// flushPendingScores the moment publishing becomes possible again.
//
// `achievedAt` is when the run ended, and it is what the server stores as the row's
// `updated_at`. A record keeps the moment it was earned, never the moment it synced,
// so a week-old record flushed today neither jumps the tie-break queue nor lands in
// the wrong day.
export type PendingScore = {
  mode: Mode
  difficulty: Difficulty
  score: number
  hits: number
  day: string // 'YYYY-MM-DD', on the shared Prague clock
  achievedAt: string // ISO 8601
}

// Rows written before `achievedAt` existed. They only ever knew the day.
type LegacyPendingScore = Omit<PendingScore, 'achievedAt'> & { achievedAt?: string }

// A legacy row is dated to the first instant of its day that is expressible without
// guessing the clock it was played on. UTC midnight falls inside the Prague day it is
// labelled with, so the record stays on the board it belongs to.
const dateLegacy = (entry: LegacyPendingScore): PendingScore => ({
  ...entry,
  achievedAt: entry.achievedAt ?? `${entry.day}T00:00:00.000Z`,
})

// One record per board per day. The queue is a record store, not a run log: a run
// that beats nothing is not worth keeping, and a beaten one is not worth sending.
export function mergePending(queue: PendingScore[], entry: PendingScore): PendingScore[] {
  const sameSlot = (other: PendingScore) =>
    other.mode === entry.mode &&
    other.difficulty === entry.difficulty &&
    other.day === entry.day
  const held = queue.find(sameSlot)
  if (held !== undefined && held.score >= entry.score) return queue
  return [...queue.filter((other) => !sameSlot(other)), entry]
}

// Collapses a queue written by an older build, which appended every run.
export const dedupePending = (queue: PendingScore[]): PendingScore[] =>
  queue.reduce<PendingScore[]>(mergePending, [])

// Listeners are notified whenever the queue is written, so the board can drop the
// local rows the moment they are published rather than on the next mount.
const listeners = new Set<() => void>()

export function subscribePendingScores(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export async function readPendingScores(): Promise<PendingScore[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_SCORES_KEY)
    if (raw === null) return []
    return (JSON.parse(raw) as LegacyPendingScore[]).map(dateLegacy)
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
  for (const listener of listeners) listener()
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
