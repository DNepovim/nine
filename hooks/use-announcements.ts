import { useEffect, useRef, useState } from 'react'

import { announcementFor, brokeOwnRecord, type Announcement } from '@/lib/announcements'

// How long an announcement holds the bar before the scores come back.
const ANNOUNCEMENT_MS = 3000

// The current announcement, or null when the bar should show scores.
//
// The record check needs the best the run *started* with, because the machine folds
// each hit straight into `stats` (machines/game.ts) — so the stored best climbs
// during the run and comparing against it live would never be true. Snapshotting at
// run start also means the announcement fires exactly once per run.
export function useAnnouncements({
  inRun,
  score,
  storedBest,
}: {
  inRun: boolean
  score: number
  storedBest: number
}): Announcement | null {
  const [current, setCurrent] = useState<Announcement | null>(null)
  const bestAtRunStart = useRef(0)
  const startedRef = useRef(false)
  const firedRef = useRef(false)

  useEffect(() => {
    if (!inRun) {
      startedRef.current = false
      setCurrent(null)
      return
    }
    // Guard so this snapshots once per run rather than on every score change.
    if (startedRef.current) return
    startedRef.current = true
    bestAtRunStart.current = storedBest
    firedRef.current = false
  }, [inRun, storedBest])

  useEffect(() => {
    if (!inRun || firedRef.current) return
    if (!brokeOwnRecord(score, bestAtRunStart.current)) return
    firedRef.current = true
    setCurrent(announcementFor('record'))
  }, [inRun, score])

  // The dismissal timer lives with the announcement, not with the score that
  // triggered it — tying it to `score` would cancel the timer on the next hit.
  useEffect(() => {
    if (!current) return
    const id = setTimeout(() => {
      setCurrent(null)
    }, ANNOUNCEMENT_MS)
    return () => {
      clearTimeout(id)
    }
  }, [current])

  return current
}
