import type { PeriodBoard } from '@/hooks/use-board'
import { useRivalRecords, type RivalAnnouncement } from '@/hooks/use-rival-records'
import { useSessionRival } from '@/hooks/use-session-rival'
import type { Leaders } from '@/lib/announcements'
import type { Difficulty, ModeId } from '@/modes'

// The rival news for the run being played, from whichever standings it is played on.
//
// On a **session** run the boards say nothing — a challenge keeps none, and the
// leaderboard its mode id reads is empty — and the session board's leader is watched
// instead. On an ordinary run there is no session to watch. So the two never both speak
// in one run, and the bar takes either the same way.
export function useRunRival({
  inRun,
  runSession,
  mode,
  difficulty,
  userId,
  leaders,
  sessionBoard,
}: {
  inRun: boolean
  runSession: string | null
  mode: ModeId
  difficulty: Difficulty
  userId: string | null
  leaders: Leaders
  sessionBoard: PeriodBoard | null
}): RivalAnnouncement | null {
  const boardRival = useRivalRecords({
    inRun: inRun && runSession === null,
    mode,
    difficulty,
    userId,
    leaders,
  })
  const sessionRival = useSessionRival({
    inRun,
    sessionId: runSession,
    userId,
    rows: sessionBoard?.rows ?? null,
  })
  return sessionRival ?? boardRival
}
