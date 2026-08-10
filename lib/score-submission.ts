import { isEmptyArray } from 'narrowland'

import { todayISO } from '@/lib/leaderboard-period'
import {
  readPendingScores,
  writePendingScores,
  type PendingScore,
} from '@/lib/pending-scores'
import { supabase } from '@/lib/supabase'
import type { Difficulty, Mode } from '@/machines/game'

async function upsertScore(userId: string, entry: PendingScore): Promise<boolean> {
  const now = new Date().toISOString()
  const [scoresRes, dailyRes] = await Promise.all([
    supabase.from('scores').upsert(
      {
        user_id: userId,
        mode: entry.mode,
        difficulty: entry.difficulty,
        best_score: entry.score,
        hits: entry.hits,
        updated_at: now,
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
        updated_at: now,
      },
      { onConflict: 'user_id,mode,difficulty,day' },
    ),
  ])
  return !scoresRes.error && !dailyRes.error
}

async function enqueue(entry: PendingScore): Promise<void> {
  const queue = await readPendingScores()
  await writePendingScores([...queue, entry])
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
  const entry: PendingScore = { mode, difficulty, score, hits, day: todayISO() }
  if (!userId || !nickname) {
    await enqueue(entry)
    return
  }
  const ok = await upsertScore(userId, entry)
  if (!ok) await enqueue(entry)
}

// On launch: deduplicate the queue and flush any pending submissions.
export async function flushPendingScores(
  userId: string,
  nickname: string,
): Promise<void> {
  if (!nickname) return
  const queue = await readPendingScores()
  if (isEmptyArray(queue)) return

  // Keep max score per (mode, difficulty, day)
  const best = new Map<string, PendingScore>()
  for (const e of queue) {
    const key = `${e.mode}-${e.difficulty}-${e.day}`
    const prev = best.get(key)
    if (!prev || e.score > prev.score) best.set(key, e)
  }

  const remaining: PendingScore[] = []
  for (const entry of best.values()) {
    const ok = await upsertScore(userId, entry)
    if (!ok) remaining.push(entry)
  }
  await writePendingScores(remaining)
}
