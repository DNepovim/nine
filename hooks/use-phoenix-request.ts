import { useSyncExternalStore } from 'react'

// The **phoenix** pinned onto whoever is signed in, from the dev sidebar.
//
// The same split, and the same answer, as the summary and announcement requests beside
// this: the hook that owns the marks is mounted inside the phone frame and the sidebar is
// mounted outside it, with no parent in common, so the two agree on a module-level store
// rather than on a provider threaded across the frame.
//
// A flag rather than the climbing count `use-summary-request.ts` keeps, and the
// difference is what each one asks for. A summary is a *moment* — it is shown once and
// gone, so the taker has to be able to tell a fresh request from the one it already
// acted on. A mark is a *standing*: it stays on until it is taken off, which is a boolean
// and reads back the same however many times it is asked.
//
// Deliberately **not** a fabricated screen, which `dev/gallery.tsx` already has several of
// under INTRO · MARK. Those answer "does the mark look right over the title"; this one
// puts the phoenix on the real signed-in player, so it appears everywhere their name does —
// the leaderboard, the score strip, a room, their own profile, the medal lines. That
// spread is the half a mocked intro cannot show, and it is where the singular
// `championMark` was still hiding on four surfaces.
//
// It overrides the server's answer rather than writing anything: nothing is published, no
// session changes hands, and a reload puts the real winner back.
//
// Nothing writes to it in a production build: the only caller is `dev/gallery.tsx`, which
// is reached through a `__DEV__` dynamic import.

let worn = false
const listeners = new Set<() => void>()

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const read = () => worn

export const togglePhoenix = () => {
  worn = !worn
  for (const listener of listeners) listener()
}

// Whether the dev sidebar is currently pinning the phoenix on this player.
export const usePhoenixWorn = (): boolean => useSyncExternalStore(subscribe, read, read)
