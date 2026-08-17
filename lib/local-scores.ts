import AsyncStorage from '@react-native-async-storage/async-storage'
import { isEmptyArray } from 'narrowland'

import { LOCAL_SCORES_KEY } from '@/constants/storage'
import { qualifiesForTab, type LeaderboardTab } from '@/lib/leaderboard-period'
import type { Difficulty, Mode } from '@/machines/game'

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
  mode: Mode
  difficulty: Difficulty
  day: string // 'YYYY-MM-DD', on the shared Prague clock
  score: number
  hits: number
  achievedAt: string // ISO 8601
  status: ScoreStatus
  attempts: number
}

// Which run this is about: one board, one day. The same slot never holds two entries.
export type ScoreSlot = Pick<LocalScore, 'mode' | 'difficulty' | 'day'>

// A score the server has refused this many times, for a reason that was not the
// connection, is not going to be accepted by asking again.
export const MAX_PUBLISH_ATTEMPTS = 5

// Everything inside this window is kept whatever its status. It covers the longest board
// that empties — a Monday-to-Sunday week — with a week of slack.
const KEEP_DAYS = 14

const inSlot = (entry: LocalScore, slot: ScoreSlot): boolean =>
  entry.mode === slot.mode &&
  entry.difficulty === slot.difficulty &&
  entry.day === slot.day

const boardKey = (entry: LocalScore): string => `${entry.mode}:${entry.difficulty}`

// Records a finished run. One entry per board per day, keeping the best — the store is a
// record of what was achieved, not a log of every attempt. Returns the store unchanged
// when the run beats nothing, so a run that improves on nothing costs no write.
//
// A better score on a slot that already published starts again as pending: the server
// holds the old number and has not been told about this one.
export function recordRun(
  store: LocalScore[],
  run: Omit<LocalScore, 'status' | 'attempts'>,
): LocalScore[] {
  const held = store.find((entry) => inSlot(entry, run))
  if (held !== undefined && held.score >= run.score) return store
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
  mode: Mode,
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
  mode: Mode,
  difficulty: Difficulty,
  tab: LeaderboardTab,
  today: string,
): number | null => bestIn(store, mode, difficulty, tab, today, () => true)

// The same, restricted to what is still waiting to publish. Only this earns the
// unpublished mark on a board: a rejected score is real, but saying it is on its way
// would be a promise the app cannot keep.
export const bestPending = (
  store: LocalScore[],
  mode: Mode,
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
