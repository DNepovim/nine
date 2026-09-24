import { useSyncExternalStore } from 'react'

import type { Announcement } from '@/lib/announcements'

// A line asked for from the dev sidebar, on its way to the announcement bar.
//
// The bar is driven by a hook inside the game screen and the sidebar is mounted outside
// the phone frame, with no parent in common — the same split the gallery's own picker
// has, and the same answer: a module-level store the two mount points can agree on
// without a provider threaded across the frame.
//
// One request at a time, taken the moment it lands. A second press while the first is
// still showing is a second line in the queue rather than a lost one, because the taking
// clears this back to null and the next press is a fresh object.
//
// Nothing writes to it in a production build: the only caller is `dev/gallery.tsx`,
// which is reached through a `__DEV__` dynamic import.
let requested: Announcement | null = null
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

export const requestAnnouncement = (announcement: Announcement) => {
  requested = announcement
  announce()
}

// Called by whoever has taken the request on, so the next press is seen as new.
export const clearAnnouncementRequest = () => {
  requested = null
  announce()
}

export const useAnnouncementRequest = (): Announcement | null =>
  useSyncExternalStore(subscribe, read, read)
