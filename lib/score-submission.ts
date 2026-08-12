import { isEmptyArray } from 'narrowland'

import { noteRequest } from '@/lib/connectivity'
import { todayISO } from '@/lib/leaderboard-period'
import {
  dedupePending,
  mergePending,
  readPendingScores,
  writePendingScores,
  type PendingScore,
} from '@/lib/pending-scores'
import { supabase } from '@/lib/supabase'
import type { Difficulty, Mode } from '@/machines/game'

// `updated_at` is the moment the run ended, not the moment it was sent. It is what the
// board sorts ties by, so a record that waited out a flight keeps the position it was
// earned in rather than being filed behind everything played since.
async function upsertScore(userId: string, entry: PendingScore): Promise<boolean> {
  const [scoresRes, dailyRes] = await Promise.all([
    supabase.from('scores').upsert(
      {
        user_id: userId,
        mode: entry.mode,
        difficulty: entry.difficulty,
        best_score: entry.score,
        hits: entry.hits,
        updated_at: entry.achievedAt,
      },
      { onConflict: 'user_id,mode,difficulty' },
    ),
    supabase.from('daily_scores').upsert(
      {
        user_id: userId,
        mode: entry.mode,
        difficulty: entry.difficulty,
        day: entry.day,
        best_score: entry.score,
        hits: entry.hits,
        updated_at: entry.achievedAt,
      },
      { onConflict: 'user_id,mode,difficulty,day' },
    ),
  ])
  noteRequest(scoresRes.error ?? dailyRes.error)
  return !scoresRes.error && !dailyRes.error
}

async function enqueue(entry: PendingScore): Promise<void> {
  const queue = await readPendingScores()
  const next = mergePending(queue, entry)
  if (next === queue) return
  await writePendingScores(next)
}

export async function submitScore(
  userId: string | null,
  nickname: string | null,
  mode: Mode,
  difficulty: Difficulty,
  score: number,
  hits: number,
): Promise<void> {
  if (mode === 'trainee' || score <= 0) return
  const entry: PendingScore = {
    mode,
    difficulty,
    score,
    hits,
    day: todayISO(),
    achievedAt: new Date().toISOString(),
  }
  if (!userId || !nickname) {
    await enqueue(entry)
    return
  }
  const ok = await upsertScore(userId, entry)
  if (!ok) await enqueue(entry)
}

// Only one drain runs at a time: the retry ticks and the online signal can both fire
// at once, and a second pass over the same queue would republish what the first is
// already sending.
let flushing = false

// Publishes everything waiting locally and keeps only what would not go. Called when a
// nickname first appears — the moment the player's local records become publishable —
// and again on every reconnection until the queue is empty.
export async function flushPendingScores(
  userId: string,
  nickname: string,
): Promise<void> {
  if (!nickname || flushing) return
  flushing = true
  try {
    const queue = await readPendingScores()
    if (isEmptyArray(queue)) return

    const remaining: PendingScore[] = []
    for (const entry of dedupePending(queue)) {
      const ok = await upsertScore(userId, entry)
      if (!ok) remaining.push(entry)
    }
    // A drain that published nothing must not rewrite the queue: writing wakes the
    // subscribers, and a wake that changes nothing would only feed the next retry.
    if (remaining.length === queue.length) return
    await writePendingScores(remaining)
  } finally {
    flushing = false
  }
}
