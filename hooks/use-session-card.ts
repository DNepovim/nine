import { useCallback, useEffect, useRef, useState } from 'react'

import type { PeriodBoard } from '@/hooks/use-board'
import { useFlag } from '@/hooks/use-flags'
import { useOpenSessions } from '@/hooks/use-open-sessions'
import { cardSession, type SessionCard } from '@/lib/challenge-session'
import type { LeaderboardRow } from '@/lib/leaderboard'
import { loadSessionBoard, type OpenSession } from '@/lib/session-board'

// The one session the start screen draws, or none.
//
// Reckoned once, from rows read once per launch, and held. A session opening or closing
// while the app is in the foreground does not change the card — the same decision the
// intro already makes about which modes are open (`openedAt` in menu-overlay.tsx), and
// for the same reason: a card that vanished under a thumb already travelling towards it
// is worse than a card that is a few minutes stale.
//
// **With one exception, and only one.** A teaser whose countdown runs out is a card that
// has to turn into the live card there and then — it has just finished telling the player
// the challenge starts *now*, and going on to say "starts in 0ʰ" until the app is
// restarted makes a liar of the one part of this screen that is a literal clock. That
// crossing is safe to wake on because it changes a card's *face*: it stays in place, stays
// pressable, and gains a START. The case the paragraph above is about — a live session
// closing, where the card leaves the screen — is still frozen, deliberately. `reckon` is
// how the card is asked to think again, and `ChallengeCountdown` calls it once, at the
// boundary, rather than on every tick.
//
// The rows themselves now come from `useOpenSessions`, which is the launch's single read
// of them and is shared with the **summary**. That it is shared changes nothing here: the
// list resolves once and keeps its identity, so the effect below fires twice — empty, then
// with rows — and never again. A live session closing still leaves this card where it is,
// and the fact that something else woke up for it is none of this card's business.

// The card and the way to reckon it again.
//
// It was returned bare for a long time, and the note here said why: a `ready` flag had sat
// beside it and nothing ever read one. `reckon` is a different kind of passenger — it is
// not a thing to wait on but a thing to call, and the only caller is the clock on the card
// itself. There is still no card until the answer arrives and no space reserved for one,
// so a session appearing a moment after the screen paints is a row arriving rather than a
// layout shifting.
//
// `cardSession` is generic over the span, which is what lets the leader ride along here
// without the pure half of the lib having to know the server's shape.
export function useSessionCard(): {
  card: SessionCard<OpenSession>
  reckon: () => void
} {
  // Asked here because this hook is mounted inside `MenuOverlay`, which is a child of
  // `FlagsProvider` and so can see the answer. See the note on `useOpenSessions`.
  const sessions = useOpenSessions(useFlag('challenges'))
  const [card, setCard] = useState<SessionCard<OpenSession>>(null)

  // Against the clock as the rows land. Runs once more than it used to — once on the
  // empty list, which resolves to no card, and once when the read answers — and the
  // first of those sets the state it was already in.
  useEffect(() => {
    setCard(cardSession(sessions, Date.now()))
  }, [sessions])

  // Think again, against the clock as it stands now. Idempotent and cheap: it is a filter
  // and a sort over at most a handful of rows, and it reads the same rows the launch read.
  const reckon = useCallback(() => {
    setCard(cardSession(sessions, Date.now()))
  }, [sessions])

  return { card, reckon }
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

// One session's standings, fetched and shaped. What the modal and the game screen both
// call; `null` while the first read for a session is in flight.
//
// `refresh` reads the same session again without blanking what is drawn: the score bar,
// the pause screen and game over all draw off this, and a strip or a table that vanished
// for the length of a round trip every time the run paused read as a board that had gone
// missing. Only a different session — or a different player — starts from nothing.
//
// `again` is any value whose change should re-read — the game screen passes whether the
// run is paused, so the pause screen opens on standings as they are now.
export function useSessionBoard(
  sessionId: string | null,
  userId: string | null,
  again: unknown = null,
) {
  const [board, setBoard] = useState<PeriodBoard | null>(null)
  const [asked, setAsked] = useState(0)
  // Whose standings `board` holds, so a re-read of the same ones keeps them on screen.
  const heldFor = useRef<string | null>(null)

  useEffect(() => {
    // No session, no standings: a board left over from the last challenge run would
    // otherwise be drawn on the next ordinary run's pause screen.
    if (sessionId === null) {
      heldFor.current = null
      setBoard(null)
      return
    }
    // Per read rather than one ref shared by all of them. Open a challenge, dismiss it,
    // and finish a run in another session before the first request lands, and a shared
    // flag — reset by the newer read — let the stale answer overwrite the newer standings.
    const read = { stale: false }
    const key = `${sessionId}|${userId ?? 'anon'}`
    if (heldFor.current !== key) {
      heldFor.current = key
      setBoard(null)
    }
    void (async () => {
      const res = await loadSessionBoard(sessionId)
      if (read.stale) return
      // A failed re-read keeps the standings already drawn — the same call `useBoard`
      // makes, for the same reason: a board that failed to load and one that emptied look
      // alike to the player, and blanking it would be the worse lie.
      setBoard((prev) =>
        res.error !== null && prev !== null
          ? prev
          : sessionBoardOf(res.rows, userId, res.error),
      )
    })()
    return () => {
      read.stale = true
    }
  }, [sessionId, userId, asked, again])

  const refresh = useCallback(() => {
    setAsked((n) => n + 1)
  }, [])

  return { board, refresh }
}
