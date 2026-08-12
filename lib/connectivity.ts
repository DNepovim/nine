// Whether the leaderboard is reachable right now.
//
// The app carries no connectivity library, and it does not need one: what matters is
// not whether a radio is on but whether Supabase answers. So reachability is read off
// the requests the game already makes — every score upsert and every board fetch
// reports its outcome here — and the answer is exactly the question the UI asks.
//
// A failure only counts when it looks like a lost connection. A rejected write is the
// server talking, which means we are online and something else is wrong.

let reachable = true

const listeners = new Set<() => void>()

// supabase-js hands a fetch rejection back as an ordinary error row, so the message is
// all there is to go on. These are the phrasings the platforms use: 'Network request
// failed' (Hermes), 'Failed to fetch' / 'Load failed' (browsers), 'fetch failed'
// (Node), plus the timeout and abort wordings.
const OFFLINE_PHRASES = [
  'network request failed',
  'failed to fetch',
  'fetch failed',
  'load failed',
  'networkerror',
  'network error',
  'timeout',
  'timed out',
  'aborted',
]

export function isNetworkFailure(message: string): boolean {
  const lower = message.toLowerCase()
  return OFFLINE_PHRASES.some((phrase) => lower.includes(phrase))
}

export const isOnline = (): boolean => reachable

export function setOnline(next: boolean): void {
  if (reachable === next) return
  reachable = next
  for (const listener of listeners) listener()
}

// Reports how a request to the server went: `null` means it answered.
export function noteRequest(error: { message: string } | null): void {
  setOnline(error === null || !isNetworkFailure(error.message))
}

export function subscribeOnline(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
