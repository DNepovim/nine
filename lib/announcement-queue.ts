import type { Announcement } from '@/lib/announcements'

// One announcement waiting for the bar.
//
// `own` marks the player's own records apart from an achievement or a rival's news. The
// ladder the bar has always kept — your own moments first — survives the wait as a place
// in the queue rather than as the right to cut in over whatever is showing.
export type Waiting = {
  announcement: Announcement
  own: boolean
}

// Shared so a queue that starts empty and a queue that empties hand back the same array,
// and an effect keyed on it does not re-run for every render of a quiet run.
export const NOTHING: readonly Waiting[] = []

// Adds one to the queue.
//
// Your own records go ahead of everything that is not yours, and behind the ones that
// are — two records crossed in a row are announced in the order they were crossed.
// Nothing ever jumps what is already on the bar: a message swapped in over the top of
// another reads as one announcement turning into another rather than as two, which is
// the whole reason there is a queue and not a swap.
export function queueAnnouncement(
  queue: readonly Waiting[],
  next: Waiting,
): readonly Waiting[] {
  const at = next.own ? queue.findIndex((waiting) => !waiting.own) : -1
  if (at === -1) return [...queue, next]
  return [...queue.slice(0, at), next, ...queue.slice(at)]
}

// Drops the one that has just taken the bar. By identity rather than by position: a
// record can join ahead of it between the moment its turn is scheduled and the moment
// it arrives, and dropping the head then would throw away the wrong one.
export const dropAnnouncement = (
  queue: readonly Waiting[],
  taken: Waiting,
): readonly Waiting[] => queue.filter((waiting) => waiting !== taken)
