import { useEffect, useMemo, useRef, useState } from 'react'

import {
  nextRivalSeq,
  RIVAL_THROTTLE_MS,
  type RivalAnnouncement,
} from '@/hooks/use-rival-records'
import type { LeaderboardRow } from '@/lib/leaderboard'
import {
  leadKept,
  sessionLeaderOf,
  sessionRivalChange,
  type SessionLeader,
} from '@/lib/session-announcements'
import type { SessionFigures } from '@/lib/session-order'
import type { Measure } from '@/modes'

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
  measure,
  run,
  runSeq,
}: {
  inRun: boolean
  sessionId: string | null
  userId: string | null
  rows: readonly LeaderboardRow[] | null
  measure: Measure
  // The run's figures as they stand. Read when a new read of the board lands and not a
  // reason to wake on: a hit changes nothing about who the standings say leads.
  run: SessionFigures
  // Which run this is. A restart can keep `inRun` up, and the new run's figures start from
  // nothing: judging a kept lead by them would report it lost while the abandoned run's
  // post is still on its way.
  runSeq: number
}): RivalAnnouncement | null {
  const [current, setCurrent] = useState<RivalAnnouncement | null>(null)
  // `undefined` is "no baseline yet", which is not the same as a baseline of an empty
  // session: a lead taken on an empty board was nobody's to lose, and null says so.
  const previousRef = useRef<SessionLeader | null | undefined>(undefined)
  const lastAtRef = useRef(0)
  const runRef = useRef(run)
  runRef.current = run

  // Keyed on the rows rather than recomputed per render, so the effect below wakes only
  // when a read actually lands.
  const leader = useMemo(
    () => (rows === null ? undefined : sessionLeaderOf(rows)),
    [rows],
  )

  useEffect(() => {
    previousRef.current = undefined
    setCurrent(null)
  }, [inRun, sessionId, runSeq])

  useEffect(() => {
    if (!inRun || sessionId === null || leader === undefined) return
    const previous = previousRef.current
    if (previous === undefined) {
      previousRef.current = leader
      return
    }
    if (leadKept(previous, leader, userId, measure, runRef.current)) return
    previousRef.current = leader

    const change = sessionRivalChange(previous, leader, userId)
    if (change === null) return

    const now = Date.now()
    if (now - lastAtRef.current < RIVAL_THROTTLE_MS) return
    lastAtRef.current = now
    setCurrent({ ...change, seq: nextRivalSeq() })
  }, [inRun, sessionId, leader, userId, measure])

  return current
}
