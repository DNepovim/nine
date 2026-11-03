import { useEffect, useRef, useState } from 'react'

import { rivalChange, type AnnouncementId, type Leaders } from '@/lib/announcements'
import { type Difficulty, type ModeId } from '@/modes'

// A busy board could otherwise hold the announcement bar for a whole run, five seconds
// at a time. One rival announcement per this window; the rest pass silently.
export const RIVAL_THROTTLE_MS = 15000

export type RivalAnnouncement = { id: AnnouncementId; name: string; seq: number }

// One count for every rival watcher, so the bar — which tells one piece of news from the
// next by `seq` — never mistakes the session's first for the boards' first.
let lastSeq = 0
export const nextRivalSeq = (): number => {
  lastSeq += 1
  return lastSeq
}

// Announces what other players do to the board while a run is in progress.
//
// It watches the board store rather than Realtime directly: the store is already
// subscribed, and the *diff between two leader snapshots* is what decides whether to
// announce. That way a partial row cannot fool it, and the rival's nickname arrives
// with the same request that confirms the new record.
export function useRivalRecords({
  inRun,
  mode,
  difficulty,
  userId,
  leaders,
}: {
  inRun: boolean
  mode: ModeId
  difficulty: Difficulty
  userId: string | null
  leaders: Leaders
}): RivalAnnouncement | null {
  const [current, setCurrent] = useState<RivalAnnouncement | null>(null)
  const previousRef = useRef<Leaders | null>(null)
  const lastAtRef = useRef(0)

  // Reset the baseline whenever a run starts or the board changes, so the first load of
  // a board is never mistaken for a rival overtaking someone.
  useEffect(() => {
    previousRef.current = null
    setCurrent(null)
  }, [inRun, mode, difficulty])

  useEffect(() => {
    if (!inRun) return
    const previous = previousRef.current
    previousRef.current = leaders
    if (previous === null) return

    const change = rivalChange(previous, leaders, userId)
    if (change === null) return

    const now = Date.now()
    if (now - lastAtRef.current < RIVAL_THROTTLE_MS) return
    lastAtRef.current = now
    setCurrent({ ...change, seq: nextRivalSeq() })
  }, [inRun, leaders, userId])

  return current
}
