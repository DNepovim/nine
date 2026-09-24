import { useEffect, useRef, useState } from 'react'

import {
  clearAnnouncementRequest,
  useAnnouncementRequest,
} from '@/hooks/use-announcement-request'
import type { RivalAnnouncement } from '@/hooks/use-rival-records'
import { achievementAnnouncement, type Award } from '@/lib/achievements'
import {
  dropAnnouncement,
  NOTHING,
  queueAnnouncement,
  type Waiting,
} from '@/lib/announcement-queue'
import { IDLE, stepRun, type RunPhase } from '@/lib/announcement-run'
import {
  ANNOUNCEMENT_IDS,
  ANNOUNCEMENT_MS,
  ANNOUNCEMENT_SWEEP_MS,
  announcementFor,
  RUN_SETTLE_MS,
  type Announcement,
  type AnnouncementId,
} from '@/lib/announcements'

// The bar's whole turn: the message, then the wipe that takes it away.
const BAR_MS = ANNOUNCEMENT_MS + ANNOUNCEMENT_SWEEP_MS

// The current announcement, or null when the bar should show scores.
//
// All of the deciding lives in `lib/announcement-run.ts` — when to freeze the targets,
// what a score has crossed, what is worth publishing — and the order they wait in lives
// in `lib/announcement-queue.ts`. This hook is what turns those answers into a bar, a
// timer and a submission, and it holds the parts that are genuinely about the passage of
// time: the run's opening quiet, each message's turn, and the dismissal.
//
// Nothing takes the bar in a run's first `RUN_SETTLE_MS`. Everything that happens in
// them waits, and is then shown one after another rather than all at once over the top
// of each other — a first run opening an empty board crosses its first record on its
// first hit, and used to have the line come and go before the player had looked up.
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
  achievements,
  onAchievementAnnounced,
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
  // Achievements earned but not yet announced, oldest first. Unlike a rival's news these
  // are never dropped: an achievement happens once in a player's life, so one that cannot
  // have the bar right now waits for it.
  achievements: readonly Award[]
  // Called once one has joined the queue, so the queue outside moves on.
  onAchievementAnnounced: (award: Award) => void
  // Called the instant a board record falls, so the score reaches the board while
  // the run is still going and rivals hear about it now rather than at game over.
  onBoardRecord: () => void
}): { announcement: Announcement | null; crossed: AnnouncementId[] } {
  const [current, setCurrent] = useState<Announcement | null>(null)
  // Everything waiting its turn at the bar, in the order it will get it.
  const [queue, setQueue] = useState<readonly Waiting[]>(NOTHING)
  // Everything this run has crossed, kept as state as well as in the phase below: the bar
  // only needs the latest crossing, but the game-over screen needs the whole run's
  // tally, and it reads it after the bar has long since cleared.
  const [taken, setTaken] = useState<AnnouncementId[]>([])
  const phaseRef = useRef<RunPhase>(IDLE)
  const lastRivalSeqRef = useRef(0)
  // When the bar opens for this run — its start plus the settling beat. Ahead of the
  // first message rather than folded into `freeAtRef` below, because the two answer
  // different questions: a bar nobody has used yet is quiet, not busy, and news that
  // lands in the quiet is still news when it lifts.
  const openAtRef = useRef(0)
  // When the bar is next free — the message's own five seconds, then its wipe.
  //
  // `current` going null is the message ending, not the bar emptying: the sweep that
  // takes it away is still running for `ANNOUNCEMENT_SWEEP_MS` after. Anything that
  // takes the bar in that window has its message swapped in over the top of the one on
  // its way out, which reads as one announcement turning into another rather than as two
  // — so the queue waits this out and each one gets its own way in and its own way out.
  const freeAtRef = useRef(0)
  const onAchievementAnnouncedRef = useRef(onAchievementAnnounced)
  onAchievementAnnouncedRef.current = onAchievementAnnounced
  // Kept current without becoming an effect dependency: the step effect keys on the
  // score and must not re-run because the parent handed us a new closure.
  const onBoardRecordRef = useRef(onBoardRecord)
  onBoardRecordRef.current = onBoardRecord

  // The run's opening quiet, timed from the run and not from the targets freezing: a
  // board that answers late must not push the first announcement late with it. Declared
  // above everything that reads these two, so a record crossed in the very commit a run
  // starts is already measured against an open bar rather than a stale one.
  useEffect(() => {
    if (!inRun) return
    openAtRef.current = Date.now() + RUN_SETTLE_MS
    freeAtRef.current = 0
  }, [inRun])

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
      setQueue(NOTHING)
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

    const announcement = announcementFor(step.announce, Math.random())
    setQueue((held) => queueAnnouncement(held, { announcement, own: true }))
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

  // The ladder, in one place: your own record beats an achievement, which beats a rival.
  //
  // What separates them is not only the order but what happens to the loser. A rival's
  // news is *dropped* — by the time the bar frees up, someone else leading is no longer
  // news. An achievement is queued, because it happens once and being swallowed by a
  // record that landed in the same second would be losing it for good. A record of your
  // own goes to the front of the queue, but not over the top of what is showing.
  //
  // Taken off the outer queue the moment it joins this one: from here on it has a place
  // in the order, and leaving it on both would announce it twice.
  useEffect(() => {
    const next = achievements[0]
    if (!inRun || next === undefined) return
    const announcement = achievementAnnouncement(next.id, Math.random())
    setQueue((held) => queueAnnouncement(held, { announcement, own: false }))
    onAchievementAnnouncedRef.current(next)
  }, [inRun, achievements])

  // A line asked for from the dev sidebar. It joins the queue like anything else, so a
  // button shows what a run shows — the opening quiet, one line at a time, each with its
  // own way in and out — rather than a message painted straight onto the bar.
  //
  // Taken whether or not there is a run to show it in: the bar is the best-scores strip,
  // which nothing but a run puts on screen, and a press made on the intro screen must not
  // lie in wait for the next one.
  const requested = useAnnouncementRequest()
  useEffect(() => {
    if (requested === null) return
    clearAnnouncementRequest()
    if (!inRun) return
    setQueue((held) => queueAnnouncement(held, { announcement: requested, own: false }))
  }, [inRun, requested])

  useEffect(() => {
    if (!inRun || rival === null) return
    if (rival.seq === lastRivalSeqRef.current) return
    lastRivalSeqRef.current = rival.seq
    // Your own moments always win the bar; the rival's is dropped rather than queued,
    // because by the time yours clears theirs is old news. Dropped through the wipe as
    // well as through the message — cutting an exit short to report that someone else
    // is ahead is the least worthy interruption the bar has. The run's opening quiet is
    // not the bar being used, so news that lands there waits for it like anything else.
    if (current !== null || queue.length > 0 || Date.now() < freeAtRef.current) return
    const announcement = announcementFor(rival.id, Math.random(), rival.name)
    setQueue((held) => queueAnnouncement(held, { announcement, own: false }))
  }, [inRun, rival, current, queue])

  // Whose turn it is. The wait is an absolute moment and not a duration, so a queue that
  // grows while one is pending reschedules without pushing back the one in front.
  useEffect(() => {
    const next = queue[0]
    if (!inRun || current !== null || next === undefined) return
    const wait = Math.max(
      0,
      openAtRef.current - Date.now(),
      freeAtRef.current - Date.now(),
    )
    const id = setTimeout(() => {
      freeAtRef.current = Date.now() + BAR_MS
      setCurrent(next.announcement)
      setQueue((held) => dropAnnouncement(held, next))
    }, wait)
    return () => {
      clearTimeout(id)
    }
  }, [inRun, current, queue])

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
