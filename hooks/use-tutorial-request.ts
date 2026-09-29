import { useSyncExternalStore } from 'react'

// Tutorial runs asked for from the dev sidebar, on their way to the game machine.
//
// The same split, and the same answer, as the announcement requests beside this: the
// machine lives inside the phone frame and the sidebar is mounted outside it, with no
// parent in common, so the two agree on a module-level store rather than on a provider
// threaded across the frame.
//
// A count rather than a flag. The lesson is worth watching more than once, and a boolean
// would need clearing by the taker before it could be asked for again — where a number
// that only climbs is new whenever it differs from the one the taker last acted on.
//
// Nothing writes to it in a production build: the only caller is `dev/gallery.tsx`, which
// is reached through a `__DEV__` dynamic import. The tutorial has a player-facing door of
// its own — TRY IT at the end of How to Play — and this is not it; this one deals the run
// from wherever the app happens to be, which is the part a dev wants and a player does not.

let dealt = 0
const listeners = new Set<() => void>()

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const read = () => dealt

export const requestTutorial = () => {
  dealt += 1
  for (const listener of listeners) listener()
}

// How many have been asked for since the app started. Whoever takes them on compares it
// with the last one it acted on; a number it has not seen is a run to deal.
export const useTutorialRequests = (): number =>
  useSyncExternalStore(subscribe, read, read)
