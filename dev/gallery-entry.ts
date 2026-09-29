import type { ReactElement } from 'react'

// What the picker lists, and the shape the switcher, the folding sections and the search
// all agree on. Its own module because the section component renders entries and the
// catalogue in gallery.tsx builds them — a type in either one would have the two importing
// each other.

// A screen: goes up over the app and stays there until it is closed.
export type Variant = {
  key: string
  label: string
  render: (close: () => void) => ReactElement
}

// A moment: plays over the running app and is gone. Nothing stays lit afterwards, so
// there is nothing to close and nothing for the stage to hold.
export type Action = { key: string; label: string; run: () => void }

export type Entry = Variant | Action

// The two are pressed the same way and sit in the same list, so one type covers both and
// a press asks which it has. Everything else about the picker — the folding, the search,
// the counts — is the same either way.
export const isVariant = (entry: Entry): entry is Variant => 'render' in entry

export type Section = { title: string; items: Entry[] }

// The top cut of the list, and the only one that says something a heading cannot: what
// pressing a thing in here does, and what has to be true for it to do anything.
export type Tier = { title: string; note?: string; sections: Section[] }
