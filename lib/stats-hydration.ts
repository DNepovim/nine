import type { Stats } from '@/machines/game'

// What came back from asking storage for the stored stats. `read: false` is the ask
// itself failing — storage unavailable, a rejected promise — as opposed to it answering
// that there is nothing there.
export type StatsRead = { read: true; raw: string | null } | { read: false }

export type Hydration = {
  // What to hydrate the machine with, or null for nothing to hydrate.
  stats: Partial<Stats> | null
  // Whether the app may start writing stats back over this key.
  mayPersist: boolean
}

const NOTHING: Hydration = { stats: null, mayPersist: false }

// Whether the player's stored history survived being read, and whether it is safe to
// write over it.
//
// The two questions are separate, and conflating them cost a player their records. A
// read that threw, or a value that will not parse, knows nothing about what is stored —
// so persisting the next stats change writes the machine's defaults plus the current run
// over a real history, and the all-time best is gone for good. Nothing may be written
// until something has actually been read.
//
// An empty key is the other case entirely: storage answered, and the answer was that
// there is nothing there. A first launch has nothing to lose by being written to, so the
// gate opens.
export function hydrateFrom(read: StatsRead): Hydration {
  if (!read.read) return NOTHING
  if (read.raw === null) return { stats: null, mayPersist: true }
  try {
    const parsed: unknown = JSON.parse(read.raw)
    // `JSON.parse` is happy with a bare number or null, neither of which is a stats
    // object — and spreading one into the machine would quietly wipe it.
    if (typeof parsed !== 'object' || parsed === null) return NOTHING
    return { stats: parsed, mayPersist: true }
  } catch {
    return NOTHING
  }
}
