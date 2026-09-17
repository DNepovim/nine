// What came back from asking storage for a persisted value. `read: false` is the ask
// itself failing — storage unavailable, a rejected promise — as opposed to it answering
// that there is nothing there.
export type StorageRead = { read: true; raw: string | null } | { read: false }

export type Hydration<T> = {
  // What to hydrate with, or null for nothing to hydrate.
  value: T | null
  // Whether the app may start writing back over this key.
  mayPersist: boolean
}

const NOTHING = { value: null, mayPersist: false }

// Whether a stored value survived being read, and whether it is safe to write over it.
//
// The two questions are separate, and conflating them cost a player their records: a
// read that threw, or a value that will not parse, knows nothing about what is stored,
// so persisting the next change writes defaults over a real history. Nothing may be
// written until something has actually been read.
//
// An empty key is the other case entirely: storage answered, and the answer was that
// there is nothing there. A first launch has nothing to lose by being written to, so
// the gate opens.
export function hydrateFrom<T>(read: StorageRead): Hydration<T> {
  if (!read.read) return NOTHING
  if (read.raw === null) return { value: null, mayPersist: true }
  try {
    const parsed: unknown = JSON.parse(read.raw)
    // `JSON.parse` is happy with a bare number or null, neither of which is the object
    // every caller here expects — and spreading one in would quietly wipe the state.
    if (typeof parsed !== 'object' || parsed === null) return NOTHING
    return { value: parsed as T, mayPersist: true }
  } catch {
    return NOTHING
  }
}

// Reads a key and reports both answers in one step, so no caller has to remember that a
// rejected read is different from an empty one.
export async function readPersisted<T>(
  get: (key: string) => Promise<string | null>,
  key: string,
): Promise<Hydration<T>> {
  const read = await get(key)
    .then((raw): StorageRead => ({ read: true, raw }))
    .catch((): StorageRead => ({ read: false }))
  return hydrateFrom<T>(read)
}
