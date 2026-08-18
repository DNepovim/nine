import { isEmptyArray } from 'narrowland'

import { captureError } from '@/lib/analytics'
import { isNetworkFailure, noteRequest } from '@/lib/connectivity'
import { todayISO } from '@/lib/leaderboard-period'
import {
  markPublished,
  noteRefusal,
  pendingOf,
  readLocalScores,
  recordRun,
  writeLocalScores,
  type LocalScore,
} from '@/lib/local-scores'
import { supabase } from '@/lib/supabase'
import type { Difficulty, Mode } from '@/machines/game'

// How the server answered. `refused` is the one that matters: the write was rejected for
// a reason that was not the connection, so asking again will be rejected again.
type Sent = 'published' | 'offline' | 'refused'

// One write, to the day. `scores` is the best day a player ever had on a board, and the
// server derives it from this row — see the `daily_scores_roll_up` trigger. Writing both
// from here was two chances to fail at something that only ever had one fact in it: a
// submit that reached `scores` but not `daily_scores` left an all-time record no day
// accounted for, and a retired entry made that permanent.
//
// `updated_at` is the moment the run ended, not the moment it was sent. It is what the
// board sorts ties by, so a record that waited out a flight keeps the position it was
// earned in rather than being filed behind everything played since.
async function upsertScore(userId: string, entry: LocalScore): Promise<Sent> {
  const { error } = await supabase.from('daily_scores').upsert(
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
  )
  noteRequest(error)
  if (error === null) return 'published'
  // A retry re-sends the same row, which the server's no-downgrade trigger makes
  // harmless.
  if (isNetworkFailure(error.message)) return 'offline'
  // A refusal is the server rejecting a score the device believes is a new best —
  // never expected, and invisible to the player, so it is exactly what error logging
  // is for.
  captureError(new Error(`score refused: ${error.message}`), {
    mode: entry.mode,
    difficulty: entry.difficulty,
    day: entry.day,
    score: entry.score,
  })
  return 'refused'
}

// Applies one send to the store. Publishing clears the entry from the queue; a refusal
// counts against it and eventually retires it; being offline changes nothing, because
// the connection coming back is exactly what makes it worth trying again.
const applySent = (store: LocalScore[], entry: LocalScore, sent: Sent): LocalScore[] => {
  if (sent === 'published') return markPublished(store, entry)
  if (sent === 'refused') return noteRefusal(store, entry)
  return store
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
  const day = todayISO()
  const run = { mode, difficulty, day, score, hits, achievedAt: new Date().toISOString() }

  // Remembered before anything is sent, and regardless of whether sending is even
  // possible. Publishing is what the rest of this does; remembering is not conditional
  // on it, and the next run has to know about this one whatever the network did.
  const before = await readLocalScores()
  const recorded = recordRun(before, run)
  // The run beat nothing the device already holds, so there is nothing new to publish
  // either — the better score is already on its way or already there.
  if (recorded === before) return

  const entry = recorded.find(
    (other) =>
      other.mode === mode && other.difficulty === difficulty && other.day === day,
  )
  if (entry === undefined || !userId || !nickname) {
    await writeLocalScores(before, recorded, day)
    return
  }

  const sent = await upsertScore(userId, entry)
  await writeLocalScores(before, applySent(recorded, entry, sent), day)
}

// Only one drain runs at a time: the retry ticks and the online signal can both fire
// at once, and a second pass over the same queue would republish what the first is
// already sending.
let flushing = false

// Publishes everything waiting on the device. Called when a nickname first appears — the
// moment the player's local records become publishable — and again on every reconnection
// until nothing is left waiting.
export async function flushPendingScores(
  userId: string,
  nickname: string,
): Promise<void> {
  if (!nickname || flushing) return
  flushing = true
  try {
    const before = await readLocalScores()
    const queue = pendingOf(before)
    if (isEmptyArray(queue)) return

    let next = before
    for (const entry of queue) {
      next = applySent(next, entry, await upsertScore(userId, entry))
    }
    // `writeLocalScores` no-ops on an unchanged reference, so a drain that published
    // nothing does not wake the subscribers and feed the next retry.
    await writeLocalScores(before, next, todayISO())
  } finally {
    flushing = false
  }
}
