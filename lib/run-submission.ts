import { isEmptyArray } from 'narrowland'

import { isNetworkFailure, noteRequest } from '@/lib/connectivity'
import { reportRefusal } from '@/lib/refusal'
import {
  dropRuns,
  queueRun,
  readRunTotals,
  sentKey,
  writeRunTotals,
  type PendingRun,
} from '@/lib/run-totals'
import { supabase } from '@/lib/supabase'
import { type Difficulty, type ScoredMode } from '@/modes'

// How the server answered. `refused` is the one that matters: the run was rejected for a
// reason that was not the connection, so asking again will be rejected again.
type Sent = 'counted' | 'offline' | 'refused'

// One run, as its lifetime counters stand.
//
// Sent wherever `submitScore` is sent — on every board record as it happens, again at
// game over, again from END RUN — because the two describe one run and a profile whose
// board has heard about a run its counters have not is a profile disagreeing with
// itself. Repeating it is harmless: the server holds the run's figures against its id
// and moves the totals by the difference, so a second post of the same run adds nothing
// and a later one adds only what the run gained in between.
async function sendRun(run: PendingRun): Promise<Sent> {
  const { error } = await supabase.rpc('record_run', {
    p_run_id: run.runId,
    p_mode: run.mode,
    p_difficulty: run.difficulty,
    p_score: run.score,
    p_hits: run.hits,
    p_acc_sum: run.accSum,
    p_spd_sum: run.spdSum,
    p_elapsed_ms: run.elapsedMs,
    p_final: run.final,
  })
  noteRequest(error)
  if (error === null) return 'counted'
  if (isNetworkFailure(error.message)) return 'offline'
  // The server rejecting a run it should have counted is invisible to the player and
  // never expected, which is exactly what error logging is for.
  reportRefusal('run', error, {
    mode: run.mode,
    difficulty: run.difficulty,
    score: run.score,
    hits: run.hits,
  })
  return 'refused'
}

// Records where a run stands: remembered on the device first, sent second.
//
// The order is the point. A run enqueued before anything is sent survives a crash
// between the two, and a device with no account yet — or no connection — keeps the run
// until there is one. Nothing here is conditional on the send being possible.
//
// Called more than once for a run that posts before it is over, and the queue keeps only
// the latest — see `queueRun`.
export async function countRun(
  userId: string | null,
  run: {
    runId: string
    mode: ScoredMode
    difficulty: Difficulty
    score: number
    hits: number
    accSum: number
    spdSum: number
    elapsedMs: number
    final: boolean
  },
): Promise<void> {
  const pending: PendingRun = { ...run, postedAt: new Date().toISOString() }
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

    const landed = new Set<string>()
    for (const run of queue) {
      const sent = await sendRun(run)
      // Offline keeps the entry: the connection coming back is exactly what makes it
      // worth trying again. A refusal drops it — the server will refuse it again, and a
      // queue that keeps retrying one bad run never reaches the good ones behind it.
      if (sent === 'offline') break
      landed.add(sentKey(run))
    }
    if (landed.size === 0) return
    // Against the queue as it stands now, not the one this pass started from: a run
    // still being played posts again while this is draining, and writing back the older
    // copy would throw that post away — see `dropRuns`.
    await writeRunTotals(dropRuns(await readRunTotals(), landed))
  } finally {
    flushing = false
  }
}
