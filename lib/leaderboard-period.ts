// The three time windows the leaderboard is sliced into, plus the date arithmetic
// they share. Days are ISO 'YYYY-MM-DD' throughout, so lexicographic comparison is
// date comparison.
//
// `week` means the current Monday-to-Sunday calendar week, not the last seven days,
// and every boundary is drawn on the Prague clock for every player.
export type LeaderboardTab = 'today' | 'week' | 'forever'

// Every player shares one clock, Prague's, so a board rolls over at the same moment
// worldwide. On the player's own clock the boards would each turn at a different
// instant, and two players could disagree about which week a score belongs to.
//
// Computed rather than read from Intl: `Intl.DateTimeFormat` with a named time zone
// has been unreliable on Hermes/Android, and Prague's rule is exact — CET (UTC+1),
// or CEST (UTC+2) from 01:00 UTC on the last Sunday of March to 01:00 UTC on the
// last Sunday of October, EU-wide since 1996.
const lastSundayUTC = (year: number, month: number): Date => {
  // Day 0 of the following month is the last day of this one.
  const d = new Date(Date.UTC(year, month + 1, 0))
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()) // getUTCDay: 0 = Sunday
  d.setUTCHours(1)
  return d
}

const pragueOffsetHours = (at: Date): number => {
  const year = at.getUTCFullYear()
  const summerFrom = lastSundayUTC(year, 2) // March
  const summerUntil = lastSundayUTC(year, 9) // October
  return at >= summerFrom && at < summerUntil ? 2 : 1
}

const HOUR_MS = 3_600_000

// The calendar date in Prague at a given instant, as ISO 'YYYY-MM-DD'.
export function dayInPrague(at: Date = new Date()): string {
  return new Date(at.getTime() + pragueOffsetHours(at) * HOUR_MS)
    .toISOString()
    .slice(0, 10)
}

// Today, on the shared Prague clock. Used both for stamping a score's day and for
// bounding the boards, so the two can never disagree about where a score belongs.
export const todayISO = (): string => dayInPrague()

const DAY_MS = 86_400_000

// How long until the day boards roll over. A board left open across the boundary would
// otherwise keep yesterday's rows until something else happened to refresh it, so this
// is what schedules the refetch. The offset is read once, so an hour is lost or gained
// across a DST change — the timer only triggers a fetch, and the fetch is what decides
// what the day is.
export function msUntilNextDay(at: Date = new Date()): number {
  const shifted = at.getTime() + pragueOffsetHours(at) * HOUR_MS
  return DAY_MS - (((shifted % DAY_MS) + DAY_MS) % DAY_MS)
}

// The Monday of the calendar week containing `day`. Weeks run Monday to Sunday on the
// Prague clock, so the `week` board is "this week so far" and empties at Prague
// midnight every Monday, rather than a rolling window that quietly drops a day.
export function weekStart(day: string): string {
  const d = new Date(`${day}T00:00:00Z`)
  // getUTCDay() is 0 for Sunday, so shift it to make Monday the zero point.
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

// The inclusive lower bound for a tab, or null for all of time. `today` is passed in
// rather than read from the clock so callers — and tests — can pin it.
export function tabSince(tab: LeaderboardTab, today: string): string | null {
  if (tab === 'forever') return null
  if (tab === 'today') return today
  return weekStart(today)
}

// Whether a stored day falls inside a tab's window.
export function qualifiesForTab(
  day: string,
  tab: LeaderboardTab,
  today: string,
): boolean {
  const since = tabSince(tab, today)
  return since === null || day >= since
}
