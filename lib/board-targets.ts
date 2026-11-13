// What the score bar measures an ordinary run against on the boards.

import type { PeriodBoard } from '@/hooks/use-board'
import { barFor, isOpenable } from '@/lib/announcements'

// What the bar measures an ordinary run against on the boards — or, on a session run,
// nothing at all. A challenge keeps no board, and the leaderboard its mode id reads is
// empty, so asking it would have every challenge run told it had opened today's. Zeroed
// rather than merely left unasked, so nothing could be crossed even if it were.
const NO_BOARD_TARGETS = {
  storedBest: 0,
  todayBest: null,
  weekBest: null,
  everBest: null,
  todayEmpty: false,
  weekEmpty: false,
} as const

export function boardTargetsOf(
  runSession: string | null,
  storedBest: number,
  board: Record<'today' | 'week' | 'forever', PeriodBoard>,
) {
  if (runSession !== null) return NO_BOARD_TARGETS
  return {
    storedBest,
    todayBest: barFor(board.today.record, board.today.myBest),
    weekBest: barFor(board.week.record, board.week.myBest),
    everBest: barFor(board.forever.record, board.forever.myBest),
    todayEmpty: isOpenable(board.today.empty, board.today.myBest),
    weekEmpty: isOpenable(board.week.empty, board.week.myBest),
  }
}
