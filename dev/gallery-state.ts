import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSyncExternalStore } from 'react'

import { readPersisted } from '@/lib/hydration'

// Which screen is on show, and which section of the picker is unfolded — kept in the
// module rather than in a component.
//
// The picker and the screen it shows are mounted in different trees: on desktop the app
// runs inside a phone frame, the picker sits on the desk outside it, and the screen has
// to render inside the app where the board store and the theme are. A module-level store
// is what lets two mount points that share no parent agree, without threading a provider
// across the frame.
//
// Written through to storage, because of the loop this thing is used in: change a line,
// watch Metro reload, look again. A picker that forgot would mean finding the same screen
// by hand every time round. Dev-only, so the key lives here rather than in
// constants/storage.ts — nothing in the shipped app has any business knowing it.
const KEY = 'nine.dev.gallery.v1'

type Saved = { shown: string | null; open: string | null }

let state: Saved = { shown: null, open: null }

const listeners = new Set<() => void>()

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

const announce = () => {
  for (const fn of listeners) fn()
}

const set = (next: Saved) => {
  state = next
  announce()
  AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {})
}

// Two snapshots rather than one object, so a section folding open does not re-render the
// stage and a screen going up does not re-render the list.
const getShown = () => state.shown
const getOpen = () => state.open

export const useShown = () => useSyncExternalStore(subscribe, getShown, getShown)
export const useOpenSection = () => useSyncExternalStore(subscribe, getOpen, getOpen)

// Showing a screen unfolds the section it was pressed in, so closing it lands back on the
// list where it was left rather than at the top. Called without one — from the stage's own
// close, or from CLOSE at the foot of the picker — the fold stays where it is.
export const show = (shown: string | null, open: string | null = state.open) => {
  set({ shown, open })
}

export const openSection = (open: string | null) => {
  set({ shown: state.shown, open })
}

const text = (source: Record<string, unknown>, name: string): string | null => {
  const value = source[name]
  return typeof value === 'string' ? value : null
}

// Read once, at import — which in a shipped app never happens: this module is reached only
// through the two `__DEV__` dynamic imports that load the gallery.
//
// Straight into `state` rather than through `set`: this is the stored value arriving, not
// a new one, and writing it back would be a round trip for nothing.
void readPersisted<Record<string, unknown>>((key) => AsyncStorage.getItem(key), KEY).then(
  ({ value }) => {
    if (value === null) return
    state = { shown: text(value, 'shown'), open: text(value, 'open') }
    announce()
  },
)
