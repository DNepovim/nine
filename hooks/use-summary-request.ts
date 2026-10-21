import { useSyncExternalStore } from 'react'

// **Summary** pages asked for from the dev sidebar, on their way to the launch popup.
//
// The same split, and the same answer, as the tutorial and announcement requests beside
// this: the hook that owns the summary is mounted inside the phone frame and the sidebar
// is mounted outside it, with no parent in common, so the two agree on a module-level
// store rather than on a provider threaded across the frame.
//
// A count rather than a flag, for the reason `use-tutorial-request.ts` gives: a boolean
// would need clearing by the taker before it could be asked for again, where a number
// that only climbs is new whenever it differs from the one the taker last acted on.
//
// What it asks for is deliberately **not** a fabricated page — `dev/gallery.tsx` already
// has six of those, and they are the right tool for looking at the layout. This asks the
// app to go and fetch a real one: the RPC, the real podium, the real deck, the real
// dialog, from wherever the app happens to be. That is the half the mocks cannot show,
// and it is the half that has actually broken — twice.
//
// It ignores the watermark, which is the whole point of a dev door: a summary that has
// already been told is exactly the one worth looking at again. Dismissing it still moves
// the watermark forward, because the watermark only ever moves forward.
//
// Nothing writes to it in a production build: the only caller is `dev/gallery.tsx`, which
// is reached through a `__DEV__` dynamic import.

let asked = 0
const listeners = new Set<() => void>()

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const read = () => asked

export const requestSummary = () => {
  asked += 1
  for (const listener of listeners) listener()
}

// How many have been asked for since the app started. Whoever takes them on compares it
// with the last one it acted on; a number it has not seen is a page to go and fetch.
export const useSummaryRequests = (): number =>
  useSyncExternalStore(subscribe, read, read)
