import { useEffect, useRef, useState } from 'react'

import type { RivalAnnouncement } from '@/hooks/use-rival-records'
import {
  ANNOUNCEMENT_IDS,
  announcementFor,
  crossedRecords,
  hasBoardRecord,
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
// are snapshotted for the same reason: they move under us now that the boards are live,
// and a rival raising one mid-run must not silently raise the bar you are chasing.
export function useAnnouncements({
  inRun,
  score,
  storedBest,
  todayBest,
  weekBest,
  everBest,
  rival,
  onBoardRecord,
}: {
  inRun: boolean
  score: number
  storedBest: number
  todayBest: number | null
  weekBest: number | null
  everBest: number | null
  // What another player just did, if anything. Always yields to your own records.
  rival: RivalAnnouncement | null
  // Called the instant a board record falls, so the score reaches the board while
  // the run is still going and rivals hear about it now rather than at game over.
  onBoardRecord: () => void
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
  const lastRivalSeqRef = useRef(0)
  // Set while one of your own records is on the bar, so a rival cannot displace it.
  const ownUntilRef = useRef(0)
  // Kept current without becoming an effect dependency: the crossing effect keys on
  // the score and must not re-run because the parent handed us a new closure.
  const onBoardRecordRef = useRef(onBoardRecord)
  onBoardRecordRef.current = onBoardRecord

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
    const fresh = crossed.filter((id) => !firedRef.current.has(id))
    const next = fresh[0]
    if (next === undefined) return
    // Mark every record this score cleared, not just the one being announced, so a
    // single big hit past two records celebrates once instead of twice in a row.
    for (const id of crossed) firedRef.current.add(id)

    // Publish before announcing. One write covers every board this score just took,
    // and the run carries on either way — submission is fire-and-forget.
    if (hasBoardRecord(fresh)) onBoardRecordRef.current()

    ownUntilRef.current = Date.now() + ANNOUNCEMENT_MS
    setCurrent(announcementFor(next, Math.random()))
  }, [inRun, score])

  useEffect(() => {
    if (!inRun || rival === null) return
    if (rival.seq === lastRivalSeqRef.current) return
    lastRivalSeqRef.current = rival.seq
    // Your own moment always wins the bar; the rival's is dropped rather than queued,
    // because by the time yours clears theirs is old news.
    if (Date.now() < ownUntilRef.current) return
    setCurrent(announcementFor(rival.id, Math.random(), rival.name))
  }, [inRun, rival])

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
  // beat a record or wait for a rival. Object.assign rather than a global declaration
  // keeps this free of type assertions, and __DEV__ keeps it out of production.
  //
  // `nineAnnounceIds` is exposed alongside so the console can list what is available
  // instead of the ids living only in a script file.
  useEffect(() => {
    if (!__DEV__) return
    Object.assign(globalThis, {
      nineAnnounce: (id: AnnouncementId, name = 'RIVAL') => {
        setCurrent(announcementFor(id, Math.random(), name))
      },
      nineAnnounceIds: [...ANNOUNCEMENT_IDS],
    })
  }, [])

  return current
}
