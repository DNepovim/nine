import { useEffect, useRef, useState } from 'react'

import type { RivalAnnouncement } from '@/hooks/use-rival-records'
import { IDLE, stepRun, type RunPhase } from '@/lib/announcement-run'
import {
  ANNOUNCEMENT_IDS,
  announcementFor,
  type Announcement,
  type AnnouncementId,
} from '@/lib/announcements'

// How long an announcement holds the bar before the scores come back.
const ANNOUNCEMENT_MS = 5000

// The current announcement, or null when the bar should show scores.
//
// All of the deciding lives in `lib/announcement-run.ts` — when to freeze the targets,
// what a score has crossed, what is worth publishing. This hook is what turns those
// answers into a bar, a timer and a submission, and it holds the parts that are genuinely
// about the passage of time: the rival's turn at the bar, and the dismissal.
//
// The personal-best check needs the best the run *started* with, because the machine
// folds each hit straight into `stats` (machines/game.ts) — so the stored best climbs
// during the run and comparing against it live would never be true. The board records are
// frozen for the same reason: they move under us now that the boards are live, and a
// rival raising one mid-run must not silently raise the bar you are chasing.
export function useAnnouncements({
  inRun,
  ready,
  score,
  storedBest,
  todayBest,
  weekBest,
  everBest,
  todayEmpty,
  weekEmpty,
  rival,
  onBoardRecord,
}: {
  inRun: boolean
  // Whether the board numbers below are worth freezing yet. A run that starts before
  // the boards have loaded would otherwise snapshot nulls and go the whole way without
  // a single announcement — the first run after a cold start, every time.
  ready: boolean
  score: number
  storedBest: number
  todayBest: number | null
  weekBest: number | null
  everBest: number | null
  // Whether the period's board is known to hold no score *and* the player has nothing
  // of their own there. False whenever we could not find out, so a board we failed to
  // read is never mistaken for an empty one.
  todayEmpty: boolean
  weekEmpty: boolean
  // What another player just did, if anything. Always yields to your own records.
  rival: RivalAnnouncement | null
  // Called the instant a board record falls, so the score reaches the board while
  // the run is still going and rivals hear about it now rather than at game over.
  onBoardRecord: () => void
}): { announcement: Announcement | null; crossed: AnnouncementId[] } {
  const [current, setCurrent] = useState<Announcement | null>(null)
  // Everything this run has crossed, kept as state as well as in the phase below: the bar
  // only needs the latest crossing, but the game-over screen needs the whole run's
  // tally, and it reads it after the bar has long since cleared.
  const [taken, setTaken] = useState<AnnouncementId[]>([])
  const phaseRef = useRef<RunPhase>(IDLE)
  const lastRivalSeqRef = useRef(0)
  // Set while one of your own records is on the bar, so a rival cannot displace it.
  const ownUntilRef = useRef(0)
  // Kept current without becoming an effect dependency: the step effect keys on the
  // score and must not re-run because the parent handed us a new closure.
  const onBoardRecordRef = useRef(onBoardRecord)
  onBoardRecordRef.current = onBoardRecord

  useEffect(() => {
    const started = phaseRef.current.started
    const step = stepRun(phaseRef.current, {
      inRun,
      ready,
      score,
      targets: {
        record: storedBest,
        today: todayBest,
        week: weekBest,
        ever: everBest,
        todayEmpty,
        weekEmpty,
      },
    })
    phaseRef.current = step.phase

    if (!inRun) {
      setCurrent(null)
      return
    }
    // Cleared as the run's targets are frozen rather than as the last run ended: the
    // game-over screen is still reading last run's medals while it is on screen.
    if (step.phase.started && !started) setTaken([])
    if (step.announce === null) return

    setTaken([...step.phase.fired])
    // Publish before announcing. One write covers every board this score just took,
    // and the run carries on either way — submission is fire-and-forget.
    if (step.publish) onBoardRecordRef.current()

    ownUntilRef.current = Date.now() + ANNOUNCEMENT_MS
    setCurrent(announcementFor(step.announce, Math.random()))
  }, [
    inRun,
    ready,
    score,
    storedBest,
    todayBest,
    weekBest,
    everBest,
    todayEmpty,
    weekEmpty,
  ])

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

  return { announcement: current, crossed: taken }
}
