import { useEffect, useMemo, useRef, useState } from 'react'

import {
  nextRivalSeq,
  RIVAL_THROTTLE_MS,
  type RivalAnnouncement,
} from '@/hooks/use-rival-records'
import type { LeaderboardRow } from '@/lib/leaderboard'
import {
  sessionLeaderOf,
  sessionRivalChange,
  type SessionLeader,
} from '@/lib/session-announcements'

// What another player just did to the **session board** being played, as `useRivalRecords`
// does for the boards — and the same shape out, so the bar takes either one the same way.
//
// It watches the session board's rows, which `useSessionBoard` re-reads on every Realtime
// event for this session. The diff between two leaders decides; see `sessionRivalChange`
// for why only the lead passing *from* the player is news.
//
// `rows` is null for an ordinary run and while the first read is out, and a run with no
// rows has no baseline: the first answer to land is the board as it stands, never a
// rival overtaking anybody.
export function useSessionRival({
  inRun,
  sessionId,
  userId,
  rows,
}: {
  inRun: boolean
  sessionId: string | null
  userId: string | null
  rows: readonly LeaderboardRow[] | null
}): RivalAnnouncement | null {
  const [current, setCurrent] = useState<RivalAnnouncement | null>(null)
  // `undefined` is "no baseline yet", which is not the same as a baseline of an empty
  // session: a lead taken on an empty board was nobody's to lose, and null says so.
  const previousRef = useRef<SessionLeader | null | undefined>(undefined)
  const lastAtRef = useRef(0)

  // Keyed on the rows rather than recomputed per render, so the effect below wakes only
  // when a read actually lands.
  const leader = useMemo(
    () => (rows === null ? undefined : sessionLeaderOf(rows)),
    [rows],
  )

  useEffect(() => {
    previousRef.current = undefined
    setCurrent(null)
  }, [inRun, sessionId])

  useEffect(() => {
    if (!inRun || sessionId === null || leader === undefined) return
    const previous = previousRef.current
    previousRef.current = leader
    if (previous === undefined) return

    const change = sessionRivalChange(previous, leader, userId)
    if (change === null) return

    const now = Date.now()
    if (now - lastAtRef.current < RIVAL_THROTTLE_MS) return
    lastAtRef.current = now
    setCurrent({ ...change, seq: nextRivalSeq() })
  }, [inRun, sessionId, leader, userId])

  return current
}
