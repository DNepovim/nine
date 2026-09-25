import { useSyncExternalStore } from 'react'

import type { Announcement } from '@/lib/announcements'

// Lines asked for from the dev sidebar, on their way to the announcement bar.
//
// The bar is driven by a hook inside the game screen and the sidebar is mounted outside
// the phone frame, with no parent in common — the same split the gallery's own picker
// has, and the same answer: a module-level store the two mount points can agree on
// without a provider threaded across the frame.
//
// A list rather than one line, because what a run does to the bar is hand it several at
// once. A record crossed on the same hit that unlocks an achievement is two lines waiting
// their turn, and that waiting — the queue, the gap between one message's wipe and the
// next one's way in — is the part a single press could never show. A press asking for
// three appends three, and they are taken together.
//
// Emptied by whoever takes them on, so the next press is seen as new. Anything asked for
// while the taker is between renders still arrives: this appends rather than replaces,
// which is what lets one press ask for a whole burst in a single tick.
//
// Nothing writes to it in a production build: the only caller is `dev/gallery.tsx`,
// which is reached through a `__DEV__` dynamic import.

// Shared so an empty store hands back the same array every read — `useSyncExternalStore`
// compares snapshots by identity, and a fresh `[]` per read would loop.
const NOTHING: readonly Announcement[] = []

let requested: readonly Announcement[] = NOTHING
const listeners = new Set<() => void>()

const announce = () => {
  for (const listener of listeners) listener()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const read = () => requested

export const requestAnnouncements = (announcements: readonly Announcement[]) => {
  if (announcements.length === 0) return
  requested = [...requested, ...announcements]
  announce()
}

// Called by whoever has taken the requests on, so the next press is seen as new.
export const clearAnnouncementRequests = () => {
  requested = NOTHING
  announce()
}

export const useAnnouncementRequests = (): readonly Announcement[] =>
  useSyncExternalStore(subscribe, read, read)
