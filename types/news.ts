import type { Ionicons } from '@expo/vector-icons'

type IoniconName = keyof typeof Ionicons.glyphMap

// One thing worth telling players about. `id` is what "already seen" is tracked
// by, so it must be stable and never reused — rewording an item keeps its id,
// and a genuinely new announcement gets a fresh one.
export type NewsItem = {
  id: string
  icon: IoniconName
  accent: string
  title: string
  body: string // markdown
}

// A dated bundle. Several items can ship together.
export type Release = {
  date: string // ISO day, e.g. '2026-08-10'
  items: NewsItem[]
}
