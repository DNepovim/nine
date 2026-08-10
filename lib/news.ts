import { z } from 'zod'

import type { NewsItem, Release } from '@/types/news'

// Ids of the items a player has already been shown. Anything unparseable is
// treated as "no record at all", which is safer than replaying old news.
const seenSchema = z.array(z.string())

export const allItems = (releases: readonly Release[]): NewsItem[] =>
  releases.flatMap((release) => release.items)

// `null` means there is no stored record — a first-ever launch, which is
// distinct from a player who has seen everything (an empty list).
function safeJson(raw: string): unknown {
  try {
    const value: unknown = JSON.parse(raw)
    return value
  } catch {
    return null
  }
}

export function parseSeenIds(raw: string | null): readonly string[] | null {
  if (raw === null) return null
  const parsed = seenSchema.safeParse(safeJson(raw))
  return parsed.success ? parsed.data : null
}

export const serializeSeenIds = (ids: readonly string[]): string => JSON.stringify(ids)

export const unseenItems = (
  releases: readonly Release[],
  seen: readonly string[],
): NewsItem[] => allItems(releases).filter((item) => !seen.includes(item.id))

// Everything missed, oldest first. RELEASES is authored newest-first because
// that is how the archive reads, but someone returning after several releases
// should walk forward through what they missed and finish on the latest news,
// not start there and travel backwards.
//
// Sorted by date rather than simply reversed: entries get appended by hand and
// by the ship skill, and a misplaced one would otherwise put the catch-up out
// of sequence with nothing to signal it. ISO days sort correctly as strings.
export const catchUpItems = (
  releases: readonly Release[],
  seen: readonly string[],
): NewsItem[] =>
  unseenItems(
    [...releases].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    seen,
  )

// Releases still worth showing, newest first, with their seen items stripped.
export const unseenReleases = (
  releases: readonly Release[],
  seen: readonly string[],
): Release[] =>
  releases
    .map((release) => ({
      ...release,
      items: release.items.filter((item) => !seen.includes(item.id)),
    }))
    .filter((release) => release.items.length > 0)
