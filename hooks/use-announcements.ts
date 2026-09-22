import { i18n } from '@lingui/core'
import { useEffect, useRef, useState } from 'react'

import { ACHIEVEMENTS } from '@/constants/achievements'
import type { RivalAnnouncement } from '@/hooks/use-rival-records'
import type { Award } from '@/lib/achievements'
import { IDLE, stepRun, type RunPhase } from '@/lib/announcement-run'
import {
  ANNOUNCEMENT_IDS,
  ANNOUNCEMENT_MS,
  ANNOUNCEMENT_SWEEP_MS,
  announcementFor,
  type Announcement,
  type AnnouncementId,
} from '@/lib/announcements'

// The bar's whole turn: the message, then the wipe that takes it away.
const BAR_MS = ANNOUNCEMENT_MS + ANNOUNCEMENT_SWEEP_MS

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
  // Called once one has had its turn, so the queue moves on.
  onAchievementAnnounced: (award: Award) => void
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

    freeAtRef.current = Date.now() + BAR_MS
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

  // The ladder, in one place: your own record beats an achievement, which beats a rival.
  //
  // What separates them is not only the order but what happens to the loser. A rival's
  // news is *dropped* — by the time the bar frees up, someone else leading is no longer
  // news. An achievement is queued, because it happens once and being swallowed by a
  // record that landed in the same second would be losing it for good.
  //
  // Queued, and then *waited for*: the bar has to be empty and its wipe has to have
  // landed. Taking it the instant `current` cleared is what made a run that unlocked
  // three at once show the first, swap the second in over it, and only then play an
  // entrance — one announcement turning into another instead of three of them in turn.
  useEffect(() => {
    const next = achievements[0]
    if (!inRun || next === undefined || current !== null) return
    // Zero for the first of a run, when there is no wipe to wait out.
    const wait = Math.max(0, freeAtRef.current - Date.now())
    const id = setTimeout(() => {
      freeAtRef.current = Date.now() + BAR_MS
      setCurrent(
        announcementFor(
          'achievement',
          Math.random(),
          `${ACHIEVEMENTS[next.id].emblem} ${i18n._(ACHIEVEMENTS[next.id].title).toUpperCase()}`,
        ),
      )
      onAchievementAnnouncedRef.current(next)
    }, wait)
    return () => {
      clearTimeout(id)
    }
  }, [inRun, achievements, current])

  useEffect(() => {
    if (!inRun || rival === null) return
    if (rival.seq === lastRivalSeqRef.current) return
    lastRivalSeqRef.current = rival.seq
    // Your own moments always win the bar; the rival's is dropped rather than queued,
    // because by the time yours clears theirs is old news. Dropped through the wipe as
    // well as through the message — cutting an exit short to report that someone else
    // is ahead is the least worthy interruption the bar has.
    if (current !== null || Date.now() < freeAtRef.current) return
    freeAtRef.current = Date.now() + BAR_MS
    setCurrent(announcementFor(rival.id, Math.random(), rival.name))
  }, [inRun, rival, current])

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
