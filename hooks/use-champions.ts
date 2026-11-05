import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { AppState } from 'react-native'

import { useOpenSessions } from '@/hooks/use-open-sessions'
import { usePhoenixWorn } from '@/hooks/use-phoenix-request'
import { subscribeBoards } from '@/lib/board-live'
import {
  mergeChampions,
  NO_CHAMPIONS,
  type ChampionRead,
  type Champions,
} from '@/lib/champions'
import { fetchTop5, leaderOf } from '@/lib/leaderboard'
import { loadLastSessionWinner } from '@/lib/session-board'
import { SCORED_MODES } from '@/modes'

// A run touches both of these boards at most once, and two requests answer for both.
// Long enough to collect the pair of events one submit makes — the write to
// `daily_scores` and the rollup's write to `scores` — since this mark is never
// mid-run urgent.
const COALESCE_MS = 800

// How long after a session's window shuts before its winner is asked for: the server's
// `session_score_grace()`, which `last_session_winner` waits out before it names anyone,
// plus the couple of seconds `useSessionSummaries` gives the two clocks to converge. Asked
// any earlier, the answer is still the previous winner.
const SESSION_SETTLE_MS = 10 * 60 * 1000 + 2000

// Who holds each mode's Extreme all-time board.
//
// Two requests — not one per player shown, and not one per run either. Gold is rank
// one, so a champion is whoever leads that board, and knowing the two ids is enough to
// mark every name in the app: a row wears the crown or a bird when its user id is one
// of them.
//
// Deliberately not part of the board store: that store follows the board being looked
// at, and these two boards have to be known whichever board that is.
//
// Kept current off the app's one board connection, the same way the medal line is.
// Asking once on mount was not enough — a player who took an Extreme all-time record
// mid-session would go on wearing last launch's mark, a stale owl on someone who had
// just earned the crown. Refetching from the game-over effect instead was worse than
// it looked: it fired alongside the submit rather than after it, so the read raced the
// write and reliably came back without the very record that triggered it. Realtime has
// no such gap — the event *is* the write landing — and it covers the two things the
// game-over hook never could: a rival taking a board while we watch, and a
// reconnection after time asleep.
//
// The phoenix is the one mark no write moves. A session is won by its window shutting,
// not by a score landing, so nothing comes down the board channel when it changes hands —
// the winner and everyone watching went on seeing the last winner's phoenix until the next
// launch. It is woken instead, once per session still open, the same way the summary is.
export function useChampions(
  userId: string | null,
  // Whether this player reaches challenges — given rather than asked for, for the reason
  // `useOpenSessions` explains. One who does not still gets the phoenix moved on the next
  // launch or return to the foreground.
  canSeeSessions: boolean,
): Champions {
  const [champions, setChampions] = useState<Champions>(NO_CHAMPIONS)
  const sessions = useOpenSessions(canSeeSessions)
  // Bumped on every load and unmount, so a slow response cannot land after a newer one.
  const requestIdRef = useRef(0)

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current
    // All three marks in one round. The session read rides along rather than taking a
    // hook of its own: it answers the same question the two boards do — who is standing
    // where, right now — and every surface that draws a name wants all three together.
    const [reads, lastWinner] = await Promise.all([
      Promise.all(
        SCORED_MODES.map(async (mode): Promise<ChampionRead> => {
          const { rows, error } = await fetchTop5(mode, 'extreme', 'forever')
          // A board we could not read says nothing about who holds it. Reporting that as
          // "nobody" would take the mark off a champion over one dropped request.
          if (error !== null) return undefined
          return leaderOf(rows)?.userId ?? null
        }),
      ),
      loadLastSessionWinner(),
    ])
    if (requestIdRef.current !== requestId) return
    const [accuracy, speed] = reads
    setChampions((prev) =>
      mergeChampions(prev, {
        accuracy,
        speed,
        // The same distinction the boards draw: a read that failed is not an answer, so
        // the phoenix stays where it was rather than coming off over one dropped request.
        challenge: lastWinner.error === null ? lastWinner.userId : undefined,
      }),
    )
  }, [])

  useEffect(() => {
    void load()

    // Only the two Extreme boards decide a champion. The other four move far more
    // often — every Easy run anyone plays — and refetching for them would ask these
    // two questions again to get the same two answers.
    let coalesce: ReturnType<typeof setTimeout> | undefined
    const unsubscribe = subscribeBoards((moved) => {
      // A move we cannot attribute is a gap we cannot see into, so it always counts.
      if (moved !== null && moved.difficulty !== 'extreme') return
      clearTimeout(coalesce)
      coalesce = setTimeout(() => void load(), COALESCE_MS)
    })

    return () => {
      requestIdRef.current++
      clearTimeout(coalesce)
      unsubscribe()
    }
  }, [load])

  // One settle timer per session, kept for as long as the hook lives. Keyed by id and
  // never cancelled when the session leaves `sessions`: the list holds only sessions still
  // open, so a refresh landing between a close and its settle (a last score posted in the
  // grace, a rename) drops the session — and a timer owned by the list would be dropped
  // with it, leaving the previous winner's mark on the screen until the next launch.
  const settleTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  useEffect(() => {
    const now = Date.now()
    for (const session of sessions) {
      if (session.closesAt <= now || settleTimers.current.has(session.id)) continue
      settleTimers.current.set(
        session.id,
        setTimeout(
          () => {
            void load()
          },
          session.closesAt - now + SESSION_SETTLE_MS,
        ),
      )
    }
  }, [sessions, load])

  useEffect(() => {
    const timers = settleTimers.current
    return () => {
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
    }
  }, [])

  // Back from the background, ask again: a phone asleep through a close or a rival's
  // record runs no timers and hears no channel.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void load()
    })
    return () => {
      subscription.remove()
    }
  }, [load])

  // The dev sidebar's phoenix, laid over the server's answer.
  //
  // Here rather than at the provider, so the override reaches every surface the real
  // mark does by the one route the real mark takes — a screen cannot be wearing a
  // different set of marks from the row that opened it. Nothing is published and no
  // session changes hands; a reload puts the real winner back. See `use-phoenix-request`,
  // which nothing writes to in a production build.
  const phoenixWorn = usePhoenixWorn()
  if (!phoenixWorn || userId === null) return champions
  return { ...champions, challenge: userId }
}

// Held once and read wherever a name is drawn — the board, the pause screen, a
// multiplayer room. A second fetch per surface would ask the same two questions again.
const ChampionsContext = createContext<Champions>(NO_CHAMPIONS)

export const ChampionsProvider = ChampionsContext.Provider

export const useChampionsContext = (): Champions => useContext(ChampionsContext)
