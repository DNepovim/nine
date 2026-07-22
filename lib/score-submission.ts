import AsyncStorage from '@react-native-async-storage/async-storage'

import { PENDING_SCORES_KEY } from '@/constants/storage'
import { supabase } from '@/lib/supabase'
import type { Difficulty, Mode } from '@/machines/game'

type PendingScore = {
  mode: Mode
  difficulty: Difficulty
  score: number
  hits: number
  day: string // 'YYYY-MM-DD'
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

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
  try {
    const raw = await AsyncStorage.getItem(PENDING_SCORES_KEY)
    const queue: PendingScore[] = raw ? (JSON.parse(raw) as PendingScore[]) : []
    queue.push(entry)
    await AsyncStorage.setItem(PENDING_SCORES_KEY, JSON.stringify(queue))
  } catch {
    // ignore
  }
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
  const entry: PendingScore = { mode, difficulty, score, hits, day: todayUTC() }
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
  try {
    const raw = await AsyncStorage.getItem(PENDING_SCORES_KEY)
    if (!raw) return
    const queue: PendingScore[] = JSON.parse(raw) as PendingScore[]
    if (queue.length === 0) return

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
    await AsyncStorage.setItem(PENDING_SCORES_KEY, JSON.stringify(remaining))
  } catch {
    // ignore
  }
}
