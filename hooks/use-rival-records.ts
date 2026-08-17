import { useEffect, useRef, useState } from 'react'

import { rivalChange, type AnnouncementId, type Leaders } from '@/lib/announcements'
import type { Difficulty, Mode } from '@/machines/game'

// A busy board could otherwise hold the announcement bar for a whole run, five seconds
// at a time. One rival announcement per this window; the rest pass silently.
const THROTTLE_MS = 15000

export type RivalAnnouncement = { id: AnnouncementId; name: string; seq: number }

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
  mode: Mode
  difficulty: Difficulty
  userId: string | null
  leaders: Leaders
}): RivalAnnouncement | null {
  const [current, setCurrent] = useState<RivalAnnouncement | null>(null)
  const previousRef = useRef<Leaders | null>(null)
  const lastAtRef = useRef(0)
  const seqRef = useRef(0)

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
    if (now - lastAtRef.current < THROTTLE_MS) return
    lastAtRef.current = now
    seqRef.current += 1
    setCurrent({ ...change, seq: seqRef.current })
  }, [inRun, leaders, userId])

  return current
}
