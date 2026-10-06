import { useSyncExternalStore } from 'react'

// What the arcade sidebar is looking at, and what it can do to it.
//
// Kept in the module rather than in a component, for the reason dev/gallery-state.ts
// already spells out: on desktop the app runs inside a phone frame and the dev tools sit on
// the desk outside it, so the two mount points share no parent. Here the gap is wider still
// — the run lives in `useArcadeRun`, which is called inside the arcade screen, several
// layers below the frame. A module-level store is what lets the sidebar reach it without
// threading a provider across the frame and down through the app.
//
// Not written through to storage, unlike the gallery's. That one remembers which screen you
// were looking at because a reload should land you back on it; this one is live state about
// a run in progress, and a reload has no run to restore it to.
//
// Nothing in a shipped app reaches this: the sidebar is behind `__DEV__` and the publish
// below is too.

export type ArcadeDevActions = {
  siegeNow: () => void
  deepenBy: (steps: number) => void
  setHearts: (hearts: number) => void
  raze: () => void
}

export type ArcadeDevState = {
  phase: string
  depth: number
  hearts: number
  // Whether a siege can be opened from where the hero stands. False at the first crossroad,
  // which has no way in for a besieged hero to be drawn on, and false mid-movement.
  canSiege: boolean
  inSiege: boolean
  actions: ArcadeDevActions
}

let state: ArcadeDevState | null = null

const listeners = new Set<() => void>()

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

const snapshot = () => state

export const useArcadeDev = () => useSyncExternalStore(subscribe, snapshot, snapshot)

// Called from the run on every beat, and with null when the screen goes away.
//
// The comparison is what keeps that cheap: a siege bumps the run's `seq` on every warrior
// that leaves the gate, and announcing an identical snapshot each time would re-render the
// sidebar at the pace of the fight for nothing. The actions are rebuilt by the hook on each
// render, so they are deliberately left out of it — what the sidebar needs to re-read them
// is a change to one of the four figures, which is the only thing it draws.
export const publishArcadeDev = (next: ArcadeDevState | null) => {
  const same =
    (state === null && next === null) ||
    (state !== null &&
      next !== null &&
      state.phase === next.phase &&
      state.depth === next.depth &&
      state.hearts === next.hearts &&
      state.canSiege === next.canSiege &&
      state.inSiege === next.inSiege)
  // The actions still have to be the current ones even when nothing drawn has moved, or a
  // button pressed after a quiet beat would call into a closure over a stale run.
  state = next
  if (same) return
  for (const fn of listeners) fn()
}
