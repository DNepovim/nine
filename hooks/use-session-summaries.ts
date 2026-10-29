import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { SEEN_SUMMARY_KEY } from '@/constants/storage'
import { requestAnnouncements } from '@/hooks/use-announcement-request'
import { useOpenSessions } from '@/hooks/use-open-sessions'
import { useSummaryRequests } from '@/hooks/use-summary-request'
import { announcementFor } from '@/lib/announcements'
import type { SessionCard } from '@/lib/challenge-session'
import type { OpenSession } from '@/lib/session-board'
import { loadSessionSummaries } from '@/lib/session-summaries'
import {
  summaryInvite,
  summaryOwed,
  summarySince,
  type SessionSummary,
} from '@/lib/session-summary'

// The **summary** a closed session is owed, and the once-ness of it.
//
// Shaped like `useWeeklyRecap`, down to why: `ready` is false until the storage read has
// answered, so whatever queues behind the launch popup is not let through while this is
// still deciding whether it has something to say; and the marker is advanced only once the
// dialog has actually been dismissed, so a launch killed with it up tells the player again.
//
// What it does that the recap does not is **wake**. A recap speaks for a week that closed
// before the app was opened and can be settled entirely at launch. A session can shut while
// the player is sitting in a run, and when it does three things have to happen at once: the
// run ends if it was that session's run, the bar says who took it if it was not, and the
// summary is waiting on the intro either way. The wake below is the one timer behind all
// three.

// How long after a window shuts before the server is asked about it.
//
// The boundary is read off the device clock and the answer is given by the server's, so the
// two have to be let converge. A couple of seconds covers the ordinary skew; a device
// further out than that simply misses the wake and is told at the next launch, which is the
// degradation this is allowed to have. Nothing here can be *wrong* — the server decides
// what closed and who won — only early or late.
const SETTLE_MS = 2000

export function useSessionSummaries(
  userId: string | null,
  // The session the current run belongs to, or null. The one thing this hook cannot work
  // out for itself, and it needs it for one decision only: a window shutting on the run
  // being played is not news to announce, it is a run about to end — see the send in
  // `app/(tabs)/index.tsx`. Telling the player on the bar and then taking the screen away
  // a second later would be the app talking over itself.
  runSessionId: string | null,
  // Whether this player reaches **challenges**, handed in rather than asked for.
  //
  // This hook is reached from the game screen's own body, and `FlagsProvider` is rendered
  // in that same component's JSX — so a provider that is not above this hook, and
  // `useFlag` here could only ever answer false. It did, and the whole feature was silent:
  // no read, no dialog, nothing. The caller resolves it from the same set it feeds the
  // provider, which is the rule that file already follows for `features.has('admin')`.
  canSee: boolean,
): {
  summary: SessionSummary | null
  invite: SessionCard<OpenSession>
  ready: boolean
  dismiss: () => void
  told: SessionSummary | null
  take: () => void
} {
  const sessions = useOpenSessions(canSee)
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  const [ready, setReady] = useState(false)
  // The summary the player has just been told, kept past its own dismissal for the one
  // thing that follows it: the **rating** dialog, which asks about that very session and
  // needs to know which. Set only by `dismiss`, so it means "the player has read it and
  // closed it" — a summary forced up from the dev sidebar counts too, which is how the
  // dialog is tested — and emptied by `take` once the rating has had its turn.
  const [told, setTold] = useState<SessionSummary | null>(null)

  // A different player on this device has nothing to rate on the last one's behalf: the
  // server would refuse it anyway, as the rating of a session that player never scored on.
  useEffect(() => {
    setTold(null)
  }, [userId])

  // Where the marker goes once this has been dismissed — the newest close of everything
  // the read returned, which is **not** the close of the page being shown when the newest
  // session names a challenge this build cannot draw. See `summaryOwed`.
  const pendingMarker = useRef<number | null>(null)

  // Kept current without becoming an effect dependency. The wake below is armed from the
  // session rows and must not be torn down and re-armed because a run started.
  const runSessionRef = useRef(runSessionId)
  runSessionRef.current = runSessionId

  // Ask, and say whatever comes back. Shared by the launch and by every wake, which is why
  // it takes `announce`: the launch has the intro to tell the player on, and a wake has
  // only the bar.
  const ask = useCallback(
    async (
      announce: boolean,
      // Asked for from the dev sidebar rather than by a launch or a wake: fetch whatever
      // the window holds and show it, watermark or no watermark. See `requestSummary`.
      forced = false,
    ) => {
      try {
        const marker = await AsyncStorage.getItem(SEEN_SUMMARY_KEY)
        const now = Date.now()

        // No record at all is a first-ever launch. Mark the moment and say nothing: a new
        // player should meet the game, not a podium from a contest they were not in.
        if (marker === null && !forced) {
          await AsyncStorage.setItem(SEEN_SUMMARY_KEY, String(now))
          return
        }
        // Nought reaches back the whole lookback once `summarySince` has floored it, which
        // is what makes a forced ask ignore a summary already told.
        const since = forced ? 0 : Number(marker)
        // A marker that is not a number is a key written by something else or corrupted.
        // Staying quiet is the safe answer; rewriting it would be this hook deciding it
        // knows better than whatever put it there.
        if (!Number.isFinite(since)) return

        const { rows, error } = await loadSessionSummaries(summarySince(since, now))
        // A failed read is not an empty fortnight. Leaving the marker where it is costs
        // one repeated request; moving it would lose the summary for good. A build older
        // than the migration lands here too, every launch, and is simply quiet.
        if (error !== null) return

        const owed = summaryOwed(rows)
        if (owed === null) return

        pendingMarker.current = owed.through
        // Nothing drawable, but the window has still passed. The marker advances on its
        // own rather than waiting for a dismissal that will never come — the same thing
        // the recap does with a week in which nobody topped a board.
        if (owed.summary === null) {
          await AsyncStorage.setItem(SEEN_SUMMARY_KEY, String(owed.through))
          pendingMarker.current = null
          return
        }
        setSummary(owed.summary)
        if (announce) tellTheBar(owed.summary, runSessionRef.current)
      } catch {
        // Storage unavailable. Telling a summary that cannot be recorded as told would
        // repeat it on every launch, so stay quiet.
      } finally {
        setReady(true)
      }
    },
    [userId],
  )

  // The launch read. `userId` is a dependency so a profile arriving on this device asks
  // again as itself — the RPC answers for `auth.uid()` and nobody else, so the answer
  // genuinely changes.
  useEffect(() => {
    if (!canSee) {
      setReady(true)
      return
    }
    void ask(false)
  }, [canSee, ask])

  // The wake. One timer per session still open when the rows landed, each firing just
  // after its own close.
  //
  // Armed from the rows rather than from a poll: the app already knows every close that is
  // coming, so a window shutting is a thing that can be waited for exactly once rather than
  // asked about every minute. A session that shuts while the app is backgrounded is caught
  // by the next launch instead, which is the same answer every other launch-time read gives.
  useEffect(() => {
    if (!canSee) return
    const now = Date.now()
    const timers = sessions
      .filter((session) => session.closesAt > now)
      .map((session) =>
        setTimeout(
          () => {
            void ask(true)
          },
          session.closesAt - now + SETTLE_MS,
        ),
      )
    return () => {
      for (const timer of timers) clearTimeout(timer)
    }
  }, [canSee, sessions, ask])

  // The dev sidebar's door. Its own effect rather than a branch inside the launch one,
  // because the two are asking different questions — "is anything owed" against "show me
  // one" — and a counter that only climbs is read by comparing, not by clearing.
  //
  // `useSummaryRequests` is a module store nothing writes to in a production build.
  const requested = useSummaryRequests()
  const taken = useRef(requested)
  useEffect(() => {
    if (requested === taken.current) return
    taken.current = requested
    void ask(false, true)
  }, [requested, ask])

  // The invitation that goes beside the page, resolved from the rows already in hand.
  // `summaryInvite` is `cardSession` — the start screen's own rule about which session it
  // may speak of — so the page can never name one the intro is not yet allowed to.
  //
  // **Memoised, and it has to be.** Two separate costs otherwise, and the comment that
  // used to sit here was wrong about both: `cardSession` builds a fresh `{state, session}`
  // wrapper every call, so the value changed identity on every render and `usePopupDeck`'s
  // memo rebuilt the whole deck with it — and this hook lives inside the game screen,
  // which re-renders on every press of the dial. The `summary === null` guard was written
  // to stop the filter and sort running during a run; it could not, because the wrapper
  // was new regardless. Keyed on the rows and on whether there is a page at all, both of
  // which change about twice a launch.
  const invite = useMemo(
    () => (summary === null ? null : summaryInvite(sessions, Date.now())),
    [summary, sessions],
  )

  // A run on a session has just let go of it, which is the player reaching the intro.
  //
  // The wake alone is not enough for that path. It fires two seconds after the close, and
  // the run the window shut under submits its own score at about the close plus the
  // one-second grace plus a round trip — so the read can land *before* the row it is
  // looking for exists. Where that run was the player's only one on the session, the
  // summary simply would not be there when they pressed HOME.
  //
  // Asking again here costs one request per challenge run and settles it: by the time the
  // intro is reached the submission has had its turn. Skipped when a page is already up,
  // which is the ordinary case and the one that needs no second opinion.
  const hadSession = useRef(runSessionId)
  useEffect(() => {
    const released = hadSession.current !== null && runSessionId === null
    hadSession.current = runSessionId
    if (!canSee || !released || summary !== null) return
    void ask(false)
  }, [runSessionId, canSee, summary, ask])

  const dismiss = useCallback(() => {
    // A deck dismissed with no summary on it — news or winnings alone — tells nothing,
    // and leaves whatever was told before it where it was.
    //
    // The first summary told keeps the question. A second can only arrive while the rating
    // is still waiting — a session shutting under the open dialog — and it has been told
    // once like any other; the rating is about the one the player closed first.
    if (summary !== null) setTold((current) => current ?? summary)
    setSummary(null)
    const marker = pendingMarker.current
    pendingMarker.current = null
    if (marker === null) return
    void AsyncStorage.setItem(SEEN_SUMMARY_KEY, String(marker)).catch(() => {
      // Storage went away between the read and here. The summary has been seen and will
      // be offered once more; one repeat beats losing the marker's meaning.
    })
  }, [summary])

  const take = useCallback(() => {
    setTold(null)
  }, [])

  return {
    summary,
    invite,
    ready,
    dismiss,
    told,
    take,
  }
}

// What the bar says when a window shuts under a player who is in the middle of something
// else. Nothing at all when they were playing that very session: the run is about to end
// and the game-over screen is the telling.
//
// `requestAnnouncements` drops the line when no run is up, by design — "a press made on the
// intro screen must not lie in wait for the next one" — so this needs no opinion about
// whether there is a bar to say it on. The summary on the intro is what tells a player who
// was not playing at all.
function tellTheBar(summary: SessionSummary, runSessionId: string | null): void {
  if (summary.sessionId === runSessionId) return
  const winner = summary.places.find((place) => place.rank === 1)
  if (winner === undefined) return
  // Off the player's own row rather than by comparing ids: the server already decided
  // where they came, and `mine.rank` is the one answer both halves of this page read.
  const mine = summary.mine.rank === 1
  requestAnnouncements([
    announcementFor(
      mine ? 'sessionWon' : 'sessionTaken',
      Math.random(),
      mine ? undefined : winner.nickname,
    ),
  ])
}
