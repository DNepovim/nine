import { nextDay, previousDay } from '@/lib/leaderboard-period'
import { awardValue, type Award, type WinPeriod } from '@/lib/winnings'
import { DIFFICULTY_ORDER, SCORED_MODES } from '@/machines/game'

// Which closed windows a launch still has to tell the player about, and how they are
// grouped once the server has answered.
//
// The whole of this file is about one off-by-one. `SEEN_WINNINGS_KEY` holds the last day
// already announced, so the span to ask for starts the day *after* it — and ends at
// yesterday, never today, because today's own day has not closed and cannot have been
// won. A day out in either direction is something a player sees: one way re-announces
// yesterday on every launch, the other silently swallows a win.

export type AnnouncementRange = { from: string; to: string }

// Null when there is nothing to say — the marker is already yesterday, which is the case
// on every launch but the first of a day.
export function announcementRange(
  // The last day already announced.
  marker: string,
  today: string,
): AnnouncementRange | null {
  const from = nextDay(marker)
  const to = previousDay(today)
  // ISO days compare correctly as strings.
  return from > to ? null : { from, to }
}

// What the marker becomes once a launch has announced everything it found. Yesterday, not
// today: storing today would skip today's own window the moment it closes tonight.
//
// Also what a device with no record at all starts from, so a first-ever launch stays quiet
// rather than opening with a ledger of days the player was not here for. That was briefly
// a second named export aliasing this one, which reads better at the two call sites and is
// still one function — so the name that says what it computes is the one that survived.
export const markerAfter = (today: string): string => previousDay(today)

// One heading in the modal and the awards under it — a day that was won, or a week.
export type AwardBlock = {
  period: WinPeriod
  wonOn: string
  awards: Award[]
}

const boardOrder = (award: Award): number =>
  SCORED_MODES.indexOf(award.mode) * 10 + DIFFICULTY_ORDER.indexOf(award.difficulty)

// Days before weeks when two blocks fall on the same date, which only happens when a week
// is won on the Monday it began.
const PERIOD_ORDER = {
  day: 0,
  week: 1,
} as const satisfies Record<WinPeriod, number>

// Newest first, and biggest first inside a block.
//
// A ledger, not a narrative — unlike the release catch-up, which runs oldest first so a
// returning player finishes on the latest news. Here the most recent win is the one the
// player is likeliest to remember earning, and the largest is the one they care about.
export function awardBlocks(awards: readonly Award[]): AwardBlock[] {
  const blocks = new Map<string, AwardBlock>()
  for (const award of awards) {
    const key = `${award.period}:${award.wonOn}`
    const held = blocks.get(key)
    if (held === undefined) {
      blocks.set(key, { period: award.period, wonOn: award.wonOn, awards: [award] })
      continue
    }
    held.awards.push(award)
  }
  return [...blocks.values()]
    .map((block) => ({
      ...block,
      awards: [...block.awards].sort(
        (a, b) => awardValue(b) - awardValue(a) || boardOrder(a) - boardOrder(b),
      ),
    }))
    .sort(
      (a, b) =>
        (a.wonOn < b.wonOn ? 1 : a.wonOn > b.wonOn ? -1 : 0) ||
        PERIOD_ORDER[a.period] - PERIOD_ORDER[b.period],
    )
}
