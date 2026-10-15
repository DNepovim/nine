import { minusDays, previousDay, todayISO, weekStart } from '@/lib/leaderboard-period'

// The stretch the admin's figures are read over, and the days it comes to.
//
// Pure, and beside `lib/admin/stats.ts` rather than in it, the same way
// `lib/challenge-session.ts` holds the arithmetic its own admin screen's calls are built
// from: the bounds are the app's definition of a day and a week and are worth testing on
// their own, and a test that imported the call beside them would be asking for a Supabase
// client to answer a question about the calendar.

// Which stretch the figures are read over.
//
// Four and not a date picker: the questions anybody opens this screen with are "what has
// happened today", "what did a whole day come to", "how is the week going" and "is the
// trend up". A control to compose a window of one's own would be a form standing where
// the answer should be.
//
// **Yesterday is the one that is a finished day**, which is what it is for: today's
// figure is always short and always rising, so it answers "is anything happening" and
// never "was that a good day".
export type StatsWindow = 'today' | 'yesterday' | 'week' | 'month'

// The Prague days a window comes to, resolved on the device the way every other board
// bound in this app is. `weekStart` is the same Monday the `week` leaderboard turns on,
// so WEEK here and the week a player sees are one week.
//
// A month is the last thirty days rather than a calendar one, because thirty days is
// exactly how long `run_receipts` is kept — see `cleanup_run_receipts`. A calendar month
// would ask for rows that have been pruned on the first of the month and answer with a
// figure that was true of a fortnight.
export function windowDays(
  window: StatsWindow,
  today = todayISO(),
): {
  from: string
  to: string
} {
  if (window === 'today') return { from: today, to: today }
  // One day, and the window before it is the day before that — which is what makes
  // yesterday the only setting here whose comparison is like for like.
  if (window === 'yesterday') {
    const day = previousDay(today)
    return { from: day, to: day }
  }
  if (window === 'week') return { from: weekStart(today), to: today }
  return { from: minusDays(today, 29), to: today }
}
