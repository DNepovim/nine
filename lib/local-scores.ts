import AsyncStorage from '@react-native-async-storage/async-storage'
import { isEmptyArray } from 'narrowland'

import { LOCAL_SCORES_KEY } from '@/constants/storage'
import { qualifiesForTab, type LeaderboardTab } from '@/lib/leaderboard-period'
import { runBeats } from '@/lib/session-order'
import { measureOf, type Difficulty, type ModeId } from '@/modes'

// Every run the device remembers, whether or not the server has it.
//
// One store, not two. A run used to be written twice — once to a daily-bests store so
// the app could answer "what did I score today?" offline, and once to a publish queue —
// under the same key, with the same keep-max rule. They were the same list wearing two
// coats. Here the queue is simply the entries that have not published yet.
//
// `achievedAt` is when the run ended, and it is what the server stores as the row's
// `updated_at`. A record keeps the moment it was earned, never the moment it synced, so
// a week-old record flushed today neither jumps the tie-break queue nor lands in the
// wrong day.
type ScoreStatus =
  // Not on the server. This is the publish queue.
  | 'pending'
  // The server has it.
  | 'published'
  // The server refused it for a reason retrying will not fix. It still counts as
  // something the player scored; it just stops asking.
  | 'rejected'

export type LocalScore = {
  mode: ModeId
  difficulty: Difficulty
  day: string // 'YYYY-MM-DD', on the shared Prague clock
  score: number
  hits: number
  achievedAt: string // ISO 8601
  status: ScoreStatus
  attempts: number
  // Which **session** this run belonged to, or absent for a run that belonged to none —
  // which is every run before challenges reached players, and every ordinary board run
  // after. An entry carrying one publishes to that session's standings instead of to
  // `daily_scores`; see lib/score-submission.ts.
  //
  // Optional rather than nullable, and the storage key deliberately does **not** move.
  // `nine.scores.v1` holds entries written before this field existed, and absent reads
  // as "not a session run", which is exactly what they were. Bumping the key to avoid a
  // migration that is not needed would throw away every score still queued for
  // publication — strictly worse than the problem it would be solving.
  sessionId?: string
  // What the run took, in ms, for a run whose session is **measured** by the clock.
  //
  // Absent on every other entry, under the same judgement `sessionId` was added by and
  // with the key again left where it is: an entry written before this field existed has
  // no time, which is exactly true of it.
  timeMs?: number
}

// Which run this is about: one board, one day — and for a session run, one **session**.
//
// The session used to be left out, on the reasoning that a challenge is on for a day, so
// one challenge on one day is one contest. That reasoning was wrong about how sessions
// are actually planned. Production ran one from 05:00 on the 14th to 05:00 on the 15th
// and the next from 06:00 on the 15th — two contests inside one Prague day, which the
// planner permits because it only refuses sessions of the same challenge that *overlap*.
//
// With one slot between them the second score was never sent: `recordRun` returns the
// store unchanged when a run beats nothing it already holds, and `submitScore` returns
// before sending when it does. A player who did better in the earlier window simply did
// not appear on the later board, with nothing anywhere saying why.
//
// Including it costs the board case nothing — an ordinary run carries no session, and
// two entries with none are still the same slot.
export type ScoreSlot = Pick<LocalScore, 'mode' | 'difficulty' | 'day' | 'sessionId'>

// A score the server has refused this many times, for a reason that was not the
// connection, is not going to be accepted by asking again.
export const MAX_PUBLISH_ATTEMPTS = 5

// Everything inside this window is kept whatever its status. It covers the longest board
// that empties — a Monday-to-Sunday week — with a week of slack.
const KEEP_DAYS = 14

const inSlot = (entry: LocalScore, slot: ScoreSlot): boolean =>
  entry.mode === slot.mode &&
  entry.difficulty === slot.difficulty &&
  entry.day === slot.day &&
  // Both absent is a match: that is every board run, and every entry written before
  // challenges existed.
  entry.sessionId === slot.sessionId

// What the pruner keeps one of, forever: the player's best per board. A session entry
// is keyed by its session as well, so one airing's best is never mistaken for another's
// — and a challenge keeps no board, so these are only ever kept for the queue's sake.
const boardKey = (entry: LocalScore): string =>
  `${entry.mode}:${entry.difficulty}:${entry.sessionId ?? ''}`

// Records a finished run. One entry per board per day, keeping the best — the store is a
// record of what was achieved, not a log of every attempt. Returns the store unchanged
// when the run beats nothing, so a run that improves on nothing costs no write.
//
// A better score on a slot that already published starts again as pending: the server
// holds the old number and has not been told about this one.
// Whether the run just played beat what the device already holds for its slot.
//
// Asked of the slot's **measure** — see `runBeats`, which is the one place the device
// writes down how a session's standings are ordered. Every board and every
// score-measured session goes by the score; a race by finishing, then hits, then the
// clock; a NO SLIP session by hits, then the score.
//
// The untimed entry on a race is what an older build's mid-run post left behind, with a
// score the finish may not reach and no time to set against it — which is why a race
// puts a finished run first. And hits come before the clock because a race is only a
// time once its drill is spent: a run left after one hit stopped at 3.1″, which on the
// clock alone beat every run that finished.
const beats = (
  run: { mode: ModeId; score: number; hits: number; timeMs?: number },
  held: LocalScore,
): boolean =>
  runBeats(
    measureOf(run.mode),
    { score: run.score, hits: run.hits, timeMs: run.timeMs ?? null },
    { score: held.score, hits: held.hits, timeMs: held.timeMs ?? null },
  )

export function recordRun(
  store: LocalScore[],
  run: Omit<LocalScore, 'status' | 'attempts'>,
): LocalScore[] {
  const held = store.find((entry) => inSlot(entry, run))
  if (held !== undefined && !beats(run, held)) return store
  const entry: LocalScore = { ...run, status: 'pending', attempts: 0 }
  return [...store.filter((other) => !inSlot(other, run)), entry]
}

const setStatus = (
  store: LocalScore[],
  slot: ScoreSlot,
  update: (entry: LocalScore) => LocalScore,
): LocalScore[] => {
  // One entry per slot is the store's invariant, so the first match is the only match.
  // An absent slot returns the store itself, which is how callers tell nothing changed.
  const index = store.findIndex((entry) => inSlot(entry, slot))
  if (index === -1) return store
  return store.map((entry, at) => (at === index ? update(entry) : entry))
}

export const markPublished = (store: LocalScore[], slot: ScoreSlot): LocalScore[] =>
  setStatus(store, slot, (entry) => ({ ...entry, status: 'published' }))

// Counts a refusal that was not the connection's fault. Past the limit the entry stops
// being retried — and stops claiming, on the board, to be waiting to sync.
export const noteRefusal = (store: LocalScore[], slot: ScoreSlot): LocalScore[] =>
  setStatus(store, slot, (entry) => {
    const attempts = entry.attempts + 1
    return {
      ...entry,
      attempts,
      status: attempts >= MAX_PUBLISH_ATTEMPTS ? 'rejected' : entry.status,
    }
  })

// The publish queue: everything still waiting to reach the server.
export const pendingOf = (store: LocalScore[]): LocalScore[] =>
  store.filter((entry) => entry.status === 'pending')

const bestIn = (
  store: LocalScore[],
  mode: ModeId,
  difficulty: Difficulty,
  tab: LeaderboardTab,
  today: string,
  keep: (entry: LocalScore) => boolean,
): number | null => {
  const scores = store
    .filter(
      (entry) =>
        entry.mode === mode &&
        entry.difficulty === difficulty &&
        qualifiesForTab(entry.day, tab, today) &&
        keep(entry),
    )
    .map((entry) => entry.score)
  return isEmptyArray(scores) ? null : Math.max(...scores)
}

// The player's own best on one board inside a period, from the device alone — every
// status counts, because all of them happened. Null when the device has nothing there,
// which is not the same as a zero.
export const bestFor = (
  store: LocalScore[],
  mode: ModeId,
  difficulty: Difficulty,
  tab: LeaderboardTab,
  today: string,
): number | null => bestIn(store, mode, difficulty, tab, today, () => true)

// The same, restricted to what is still waiting to publish. Only this earns the
// unpublished mark on a board: a rejected score is real, but saying it is on its way
// would be a promise the app cannot keep.
export const bestPending = (
  store: LocalScore[],
  mode: ModeId,
  difficulty: Difficulty,
  tab: LeaderboardTab,
  today: string,
): number | null =>
  bestIn(store, mode, difficulty, tab, today, (entry) => entry.status === 'pending')

// Bounds the store. Everything inside the window is kept, plus the single best entry per
// board of all time — that one is what still has something to say to the all-time board
// long after its day has passed, and without it a queue drained late would publish
// nothing worth publishing.
//
// The old queue had no prune at all: a player who played daily without ever setting a
// nickname accumulated an entry per board per day forever, and the first flush then sent
// them one at a time.
export function pruneLocalScores(store: LocalScore[], today: string): LocalScore[] {
  const oldest = new Date(`${today}T00:00:00Z`)
  oldest.setUTCDate(oldest.getUTCDate() - (KEEP_DAYS - 1))
  const cutoff = oldest.toISOString().slice(0, 10)

  const bestPerBoard = new Map<string, LocalScore>()
  for (const entry of store) {
    const held = bestPerBoard.get(boardKey(entry))
    if (held === undefined || entry.score > held.score) {
      bestPerBoard.set(boardKey(entry), entry)
    }
  }
  const keepers = new Set(bestPerBoard.values())

  return store.filter((entry) => entry.day >= cutoff || keepers.has(entry))
}

// Listeners are notified on every write, so a run reaches the boards on screen without
// waiting for anything to remount.
const listeners = new Set<() => void>()

export function subscribeLocalScores(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export async function readLocalScores(): Promise<LocalScore[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_SCORES_KEY)
    if (raw === null) return []
    return JSON.parse(raw) as LocalScore[]
  } catch {
    return []
  }
}

// Writes only when something changed — the caller passes the store it started from, and
// an unchanged reference means there is nothing to save. Writing wakes every subscriber,
// and a wake that changes nothing only feeds the next retry.
export async function writeLocalScores(
  before: LocalScore[],
  after: LocalScore[],
  today: string,
): Promise<void> {
  if (after === before) return
  try {
    await AsyncStorage.setItem(
      LOCAL_SCORES_KEY,
      JSON.stringify(pruneLocalScores(after, today)),
    )
  } catch {
    // ignore — the store is best-effort, and a score on its way to the server is
    // unaffected by failing to remember it here
  }
  for (const listener of listeners) listener()
}
