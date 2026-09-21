import AsyncStorage from '@react-native-async-storage/async-storage'

import { RUN_TOTALS_KEY } from '@/constants/storage'
import type { Difficulty, ScoredMode } from '@/machines/modes'

// Runs whose lifetime counters have not reached the server yet.
//
// A queue rather than a fire-and-forget call: a run played on a train is still a run the
// player played, and a count that quietly skipped it would be wrong in a way nobody
// could ever notice or repair. The scores store cannot carry this — it keeps the best
// run per board per day, and a counter needs every run, including the ones that beat
// nothing and the second and third of the same afternoon.
//
// `runId` is what makes the send exactly-once; see lib/run-id.ts and the `record_run`
// receipts table.
export type PendingRun = {
  runId: string
  mode: ScoredMode
  difficulty: Difficulty
  score: number
  hits: number
  // Sum over the run's hits of each hit's accuracy / speed factor. The server adds these
  // to the board's totals; an average is the sum over the hits, computed on read.
  accSum: number
  spdSum: number
  endedAt: string // ISO 8601
}

// What the queue is bounded by. A device that plays without ever reaching the server —
// no connection, no account yet — must not accumulate rows forever, and a month-old run
// that has never landed is not going to.
const KEEP_RUNS = 200
const KEEP_DAYS = 30

export const queueRun = (store: PendingRun[], run: PendingRun): PendingRun[] => [
  ...store,
  run,
]

// Drops a run that has landed. Called with the id rather than the entry so a flush does
// not depend on the store it started from still being the store.
export const dropRun = (store: PendingRun[], runId: string): PendingRun[] =>
  store.filter((run) => run.runId !== runId)

// Newest first past the count bound, so a device that has been offline for a month
// keeps the runs it is most likely to still be able to place.
export function pruneRunTotals(store: PendingRun[], now: number): PendingRun[] {
  const cutoff = now - KEEP_DAYS * 24 * 60 * 60 * 1000
  const fresh = store.filter((run) => Date.parse(run.endedAt) >= cutoff)
  if (fresh.length <= KEEP_RUNS) return fresh
  return [...fresh]
    .sort((a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt))
    .slice(0, KEEP_RUNS)
}

export async function readRunTotals(): Promise<PendingRun[]> {
  try {
    const raw = await AsyncStorage.getItem(RUN_TOTALS_KEY)
    if (raw === null) return []
    return JSON.parse(raw) as PendingRun[]
  } catch {
    return []
  }
}

export async function writeRunTotals(store: PendingRun[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      RUN_TOTALS_KEY,
      JSON.stringify(pruneRunTotals(store, Date.now())),
    )
  } catch {
    // ignore — the queue is best-effort, and a run already on its way to the server is
    // unaffected by failing to remember it here
  }
}
