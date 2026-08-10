// The three time windows the leaderboard is sliced into, plus the date arithmetic
// they share. Days are ISO 'YYYY-MM-DD' throughout, so lexicographic comparison is
// date comparison, and everything is UTC to match how the server stores a day.
export type LeaderboardTab = 'today' | 'week' | 'forever'

const WEEK_DAYS = 7

export const todayISO = (): string => new Date().toISOString().slice(0, 10)

// The inclusive lower bound for a tab, or null for all of time. `today` is passed in
// rather than read from the clock so callers — and tests — can pin it.
export function tabSince(tab: LeaderboardTab, today: string): string | null {
  if (tab === 'forever') return null
  if (tab === 'today') return today
  const d = new Date(`${today}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - (WEEK_DAYS - 1))
  return d.toISOString().slice(0, 10)
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
