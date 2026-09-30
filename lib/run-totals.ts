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
// `runId` is what lets a run be posted more than once without being counted more than
// once: it is minted when the run is dealt, put away with it, and the server holds the
// run's figures against it — see lib/run-id.ts, machines/game.ts and `record_run`.
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
  // How long the run was actually played, as the machine froze it — pause time excluded.
  elapsedMs: number
  // Whether the run was over when this was written. A run posts its counters early —
  // every time a board record takes its score public — so the board and the profile
  // never describe different sets of runs; only the last post closes the run on the
  // server, and nothing may be posted under the same name after it.
  final: boolean
  // When this entry was written, which is not when the run ended: a run still being
  // played posts several times. What the pruning below measures age against, and what
  // tells a drained entry from the one that replaced it while it was draining.
  postedAt: string // ISO 8601
}

// The same run as a queue written by an earlier build has it. A device updating
// mid-queue is the ordinary case, not an edge one — the runs it is still holding were
// written by the build before this. Everything an older build wrote was written at game
// over and under a name of its own, which is `final` with nothing else to follow it.
type StoredRun = Omit<PendingRun, 'elapsedMs' | 'final' | 'postedAt'> & {
  elapsedMs?: number
  final?: boolean
  postedAt?: string
  endedAt?: string
}

// What the queue is bounded by. A device that plays without ever reaching the server —
// no connection, no account yet — must not accumulate rows forever, and a month-old run
// that has never landed is not going to.
const KEEP_RUNS = 200
const KEEP_DAYS = 30

// One entry per run, however often it posts. A later post says everything an earlier one
// said and more — every figure a run carries only grows while it is played — so the
// queue keeps the last word and throws the rest away.
export const queueRun = (store: PendingRun[], run: PendingRun): PendingRun[] => [
  ...store.filter((held) => held.runId !== run.runId),
  run,
]

// Drops the entries that have landed, off the queue as it stands now rather than off the
// copy the flush started from — a run still being played can post again while the queue
// is draining, and that post must survive the drain. An entry is only dropped when the
// one in the store is the one that was sent, which `postedAt` identifies: a replacement
// carries a later stamp and stays.
export const dropRuns = (store: PendingRun[], sent: ReadonlySet<string>): PendingRun[] =>
  store.filter((run) => !sent.has(sentKey(run)))

// What `dropRuns` matches on: which run, and which of its posts.
export const sentKey = (run: PendingRun): string => `${run.runId}@${run.postedAt}`

// Newest first past the count bound, so a device that has been offline for a month
// keeps the runs it is most likely to still be able to place.
export function pruneRunTotals(store: PendingRun[], now: number): PendingRun[] {
  const cutoff = now - KEEP_DAYS * 24 * 60 * 60 * 1000
  const fresh = store.filter((run) => Date.parse(run.postedAt) >= cutoff)
  if (fresh.length <= KEEP_RUNS) return fresh
  return [...fresh]
    .sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt))
    .slice(0, KEEP_RUNS)
}

export async function readRunTotals(): Promise<PendingRun[]> {
  try {
    const raw = await AsyncStorage.getItem(RUN_TOTALS_KEY)
    if (raw === null) return []
    // A run queued before this build knew to time it lands with a length of zero, which
    // is the truth about what was recorded rather than a guess dressed as a measurement.
    // An entry with no stamp at all — neither field, so neither this build nor the one
    // before it wrote it — is left to the pruning, which is the safe way round: a queue
    // entry nothing can date is one nothing can be trusted to stop retrying.
    return (JSON.parse(raw) as StoredRun[]).map((run) => ({
      ...run,
      elapsedMs: run.elapsedMs ?? 0,
      final: run.final ?? true,
      postedAt: run.postedAt ?? run.endedAt ?? new Date(0).toISOString(),
    }))
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
