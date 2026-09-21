import { isEmptyArray } from 'narrowland'

import { captureError } from '@/lib/analytics'
import { isNetworkFailure, noteRequest } from '@/lib/connectivity'
import { newRunId } from '@/lib/run-id'
import {
  dropRun,
  queueRun,
  readRunTotals,
  writeRunTotals,
  type PendingRun,
} from '@/lib/run-totals'
import { supabase } from '@/lib/supabase'
import type { Difficulty, ScoredMode } from '@/machines/modes'

// How the server answered. `refused` is the one that matters: the run was rejected for a
// reason that was not the connection, so asking again will be rejected again.
type Sent = 'counted' | 'offline' | 'refused'

// One run, added to the player's lifetime counters.
//
// Deliberately not folded into `submitScore`: that one is called several times per run —
// on every board record as it happens, again at game over, again from END RUN — because
// it upserts a best and repeating it is harmless. A counter incremented in the same
// place would report five runs for one.
async function sendRun(run: PendingRun): Promise<Sent> {
  const { error } = await supabase.rpc('record_run', {
    p_run_id: run.runId,
    p_mode: run.mode,
    p_difficulty: run.difficulty,
    p_score: run.score,
    p_hits: run.hits,
    p_acc_sum: run.accSum,
    p_spd_sum: run.spdSum,
  })
  noteRequest(error)
  if (error === null) return 'counted'
  if (isNetworkFailure(error.message)) return 'offline'
  // The server rejecting a run it should have counted is invisible to the player and
  // never expected, which is exactly what error logging is for.
  captureError(new Error(`run refused: ${error.message}`), {
    mode: run.mode,
    difficulty: run.difficulty,
    score: run.score,
    hits: run.hits,
  })
  return 'refused'
}

// Records a finished run: remembered on the device first, sent second.
//
// The order is the point. A run enqueued before anything is sent survives a crash
// between the two, and a device with no account yet — or no connection — keeps the run
// until there is one. Nothing here is conditional on the send being possible.
export async function countRun(
  userId: string | null,
  run: {
    mode: ScoredMode
    difficulty: Difficulty
    score: number
    hits: number
    accSum: number
    spdSum: number
  },
): Promise<void> {
  const pending: PendingRun = {
    ...run,
    runId: newRunId(),
    endedAt: new Date().toISOString(),
  }
  const store = await readRunTotals()
  await writeRunTotals(queueRun(store, pending))
  if (userId === null) return
  await flushRunTotals(userId)
}

// Only one drain runs at a time: a reconnection and a freshly finished run can both ask
// at once, and a second pass over the same queue would send what the first is sending.
let flushing = false

// Sends everything the device is still holding. Called after a run is recorded, and
// again on every reconnection until the queue is empty.
export async function flushRunTotals(userId: string): Promise<void> {
  if (!userId || flushing) return
  flushing = true
  try {
    const queue = await readRunTotals()
    if (isEmptyArray(queue)) return

    let next = queue
    for (const run of queue) {
      const sent = await sendRun(run)
      // Offline keeps the entry: the connection coming back is exactly what makes it
      // worth trying again. A refusal drops it — the server will refuse it again, and a
      // queue that keeps retrying one bad run never reaches the good ones behind it.
      if (sent !== 'offline') next = dropRun(next, run.runId)
      if (sent === 'offline') break
    }
    if (next !== queue) await writeRunTotals(next)
  } finally {
    flushing = false
  }
}
