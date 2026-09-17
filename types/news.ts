import type { Ionicons } from '@expo/vector-icons'
import type { MessageDescriptor } from '@lingui/core'

type IoniconName = keyof typeof Ionicons.glyphMap

// One thing worth telling players about. `id` is what "already seen" is tracked
// by, so it must be stable and never reused — rewording an item keeps its id,
// and a genuinely new announcement gets a fresh one.
export type NewsItem = {
  id: string
  icon: IoniconName
  accent: string
  // Descriptors rather than strings: the copy is resolved by whatever draws it, so
  // a language change re-renders the card instead of leaving whichever text was
  // current when this module first loaded.
  title: MessageDescriptor
  body: MessageDescriptor // markdown
}

// A dated bundle. Several items can ship together.
export type Release = {
  date: string // ISO day, e.g. '2026-08-10'
  items: NewsItem[]
}
