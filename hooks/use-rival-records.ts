import { useEffect, useRef, useState } from 'react'

import { rivalChange, type AnnouncementId, type Leaders } from '@/lib/announcements'
import { boardFilter, isBoardEvent } from '@/lib/board-events'
import { supabase } from '@/lib/supabase'
import type { Difficulty, Mode } from '@/machines/game'

// A busy board could otherwise hold the announcement bar for a whole run, five seconds
// at a time. One rival announcement per this window; the rest pass silently.
const THROTTLE_MS = 15000

export type RivalAnnouncement = { id: AnnouncementId; name: string; seq: number }

// Watches the board for other players' records while a run is in progress.
//
// Realtime is used only as a "something moved" nudge — the payload is never read.
// Every nudge refreshes the leaders, and the *diff between two leader snapshots* is
// what decides whether to announce. That way a partial row cannot fool it, and the
// rival's nickname arrives with the same request that confirms the new record.
//
// The channel exists only during a run: off the menu there is nothing to interrupt, and
// the bar is hidden behind the overlay anyway.
export function useRivalRecords({
  inRun,
  mode,
  difficulty,
  userId,
  leaders,
  refresh,
}: {
  inRun: boolean
  mode: Mode
  difficulty: Difficulty
  userId: string | null
  leaders: Leaders
  refresh: () => void
}): RivalAnnouncement | null {
  const [current, setCurrent] = useState<RivalAnnouncement | null>(null)
  const previousRef = useRef<Leaders | null>(null)
  const lastAtRef = useRef(0)
  const seqRef = useRef(0)

  // Keep the callback current without re-subscribing on every render.
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  useEffect(() => {
    if (!inRun || mode === 'trainee') return

    // A fresh topic each time: the same board is often live in more than one place, and
    // reusing a topic makes supabase-js throw when the second channel binds while the
    // first is still subscribed.
    const filter = boardFilter(mode)
    const channel = supabase
      .channel(`rival:${mode}:${difficulty}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scores', filter },
        (payload) => {
          if (isBoardEvent(payload, difficulty)) refreshRef.current()
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_scores', filter },
        (payload) => {
          if (isBoardEvent(payload, difficulty)) refreshRef.current()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [inRun, mode, difficulty])

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
