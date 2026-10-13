import { useEffect, useRef, useState } from 'react'

import type { PeriodBoard } from '@/hooks/use-board'
import { useFlag } from '@/hooks/use-flags'
import { cardSession, type SessionCard } from '@/lib/challenge-session'
import type { LeaderboardRow } from '@/lib/leaderboard'
import { loadOpenSessions, loadSessionBoard, type OpenSession } from '@/lib/session-board'
import { modeById } from '@/modes'

// The one session the start screen draws, or none.
//
// Read once per launch and held. A session opening or closing while the app is in the
// foreground does not change the card — the same decision the intro already makes about
// which modes are open (`openedAt` in menu-overlay.tsx), and for the same reason: a card
// that vanished under a thumb already travelling towards it is worse than a card that is
// a few minutes stale.
//
// The feature gates the *read*, not just the card. A player who can never be shown this
// has no business asking the server about it — the same rule `useWeeklyRecap` keeps.

// The card, or none. Returned bare rather than wrapped in an object: it held a `ready`
// flag beside it for a while, and nothing ever read one — the card is the only thing
// waiting on this read and it has nothing to hold still for. There is no card until the
// answer arrives and no space reserved for one, so a session appearing a moment after
// the screen paints is a row arriving rather than a layout shifting.
//
// `cardSession` is generic over the span, which is what lets the leader ride along here
// without the pure half of the lib having to know the server's shape.
export function useSessionCard(): SessionCard<OpenSession> {
  const canSee = useFlag('challenges')
  const [card, setCard] = useState<SessionCard<OpenSession>>(null)

  // A ref rather than a local `let`, which is the shape `use-board.ts` uses for the
  // same job: a plain flag reads as always-false to the type checker, since nothing it
  // can see sets it between the read and the check.
  const dropped = useRef(false)

  useEffect(() => {
    if (!canSee) return
    dropped.current = false
    void (async () => {
      const res = await loadOpenSessions()
      if (dropped.current) return
      // A session naming a challenge this build has never heard of is skipped rather
      // than drawn: there is no name to print and no rules to run it under. The same
      // answer `modeById` gives everywhere else, and a device older than the server is
      // the ordinary way it happens.
      const known = res.rows.filter((row) => modeById(row.modeId) !== null)
      setCard(cardSession(known, Date.now()))
    })()
    return () => {
      dropped.current = true
    }
  }, [canSee])

  return card
}

// One session's standings in the shape `TabPanel` draws.
//
// Here rather than in `lib/session-board.ts` because `PeriodBoard` lives in
// `hooks/use-board.ts` and nothing in `lib/` imports from `hooks/`. A session has no
// periods, so most of this is the quiet answer: no unpublished mark — a session score is
// never held back waiting for a nickname the way a board score is — and `myRank` comes
// off the rows themselves, since a session board has no cut to fall below.
function sessionBoardOf(
  rows: readonly LeaderboardRow[],
  userId: string | null,
  error: string | null,
): PeriodBoard {
  const mine = userId === null ? undefined : rows.find((row) => row.user_id === userId)
  const top = rows[0]
  return {
    rows: [...rows],
    myRank:
      mine === undefined
        ? null
        : {
            rank: mine.rank,
            total: rows.length,
            best_score: mine.best_score,
            hits: mine.hits,
          },
    loading: false,
    error,
    record: top?.best_score ?? null,
    recordIsMine: top !== undefined && userId !== null && top.user_id === userId,
    recordHolder:
      top === undefined
        ? null
        : {
            userId: top.user_id,
            nickname: top.nickname,
            avgAccuracy: top.avg_acc,
            avgSpeed: top.avg_spd,
          },
    // Known to be empty only when the read came back. A session we failed to read is not
    // a session nobody has played.
    empty: error === null && rows.length === 0,
    myBest: mine?.best_score ?? 0,
    unpublished: null,
  }
}

// One session's standings, fetched and shaped. What the modal and the game-over screen
// both call; `null` while it is still in flight.
export function useSessionBoard(sessionId: string | null, userId: string | null) {
  const [board, setBoard] = useState<PeriodBoard | null>(null)

  // Dropped the same way `useSessionCard` above drops its read. Open a challenge, dismiss
  // it, and finish a run in another session before the first request lands, and without
  // this the stale answer overwrites the newer standings.
  const stale = useRef(false)

  useEffect(() => {
    if (sessionId === null) return
    stale.current = false
    setBoard(null)
    void (async () => {
      const res = await loadSessionBoard(sessionId)
      if (stale.current) return
      setBoard(sessionBoardOf(res.rows, userId, res.error))
    })()
    return () => {
      stale.current = true
    }
  }, [sessionId, userId])

  return { board }
}
