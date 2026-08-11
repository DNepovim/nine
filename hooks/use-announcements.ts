import { useEffect, useRef, useState } from 'react'

import {
  announcementFor,
  crossedRecords,
  type Announcement,
  type AnnouncementId,
} from '@/lib/announcements'

// How long an announcement holds the bar before the scores come back.
const ANNOUNCEMENT_MS = 5000

// The current announcement, or null when the bar should show scores.
//
// The personal-best check needs the best the run *started* with, because the machine
// folds each hit straight into `stats` (machines/game.ts) — so the stored best climbs
// during the run and comparing against it live would never be true. The board records
// are snapshotted for the same reason: they only refresh between runs today, but
// pinning them keeps a mid-run refresh from moving the goalposts.
export function useAnnouncements({
  inRun,
  score,
  storedBest,
  todayBest,
  weekBest,
  everBest,
}: {
  inRun: boolean
  score: number
  storedBest: number
  todayBest: number | null
  weekBest: number | null
  everBest: number | null
}): Announcement | null {
  const [current, setCurrent] = useState<Announcement | null>(null)
  const targetsRef = useRef({
    record: 0,
    today: null as number | null,
    week: null as number | null,
    ever: null as number | null,
  })
  const startedRef = useRef(false)
  const firedRef = useRef(new Set<AnnouncementId>())

  useEffect(() => {
    if (!inRun) {
      startedRef.current = false
      setCurrent(null)
      return
    }
    // Guard so this snapshots once per run rather than on every score change.
    if (startedRef.current) return
    startedRef.current = true
    targetsRef.current = {
      record: storedBest,
      today: todayBest,
      week: weekBest,
      ever: everBest,
    }
    firedRef.current = new Set()
  }, [inRun, storedBest, todayBest, weekBest, everBest])

  useEffect(() => {
    if (!inRun) return
    const crossed = crossedRecords(score, targetsRef.current)
    const next = crossed.find((id) => !firedRef.current.has(id))
    if (next === undefined) return
    // Mark every record this score cleared, not just the one being announced, so a
    // single big hit past two records celebrates once instead of twice in a row.
    for (const id of crossed) firedRef.current.add(id)
    setCurrent(announcementFor(next, Math.random()))
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

  // Dev-only escape hatch: fire any announcement from the console without having to
  // actually beat a record, so the celebrations can be watched on demand. Object.assign
  // rather than a global declaration keeps this free of type assertions, and the
  // __DEV__ guard keeps it out of production bundles.
  useEffect(() => {
    if (!__DEV__) return
    Object.assign(globalThis, {
      nineAnnounce: (id: AnnouncementId) => {
        setCurrent(announcementFor(id, Math.random()))
      },
    })
  }, [])

  return current
}
