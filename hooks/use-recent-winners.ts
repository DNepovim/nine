import { useEffect, useRef, useState } from 'react'

import { subscribeBoards } from '@/lib/board-live'
import { fetchPastWinners, NO_PAST_WINNERS, type PastWinners } from '@/lib/leaderboard'
import { winnerLines, type WinnerLine } from '@/lib/recent-winners'
import { type Difficulty, type ModeId } from '@/modes'

// Who took this board yesterday and last week, as the lines the stripe cycles.
//
// No realtime subscription, unlike every other board read in the app: both windows
// closed before this screen opened, so nothing anyone plays today can change who won
// them. The one thing that does move them is Prague midnight, which makes yesterday
// the day before last — not worth a timer for a screen nobody sits on across it, and
// the next mount reads the right windows anyway.
//
// The one board signal it does hear is the unattributed one: a reconnection, a return to
// the foreground, or the player renaming themselves. None of those can change who won,
// but the last can change what the winner is called.
export function useRecentWinners(mode: ModeId, difficulty: Difficulty): WinnerLine[] {
  const [winners, setWinners] = useState<PastWinners>(NO_PAST_WINNERS)
  // Bumped on every load and unmount, so a slow response for a board the player has
  // since switched away from can tell and drop itself.
  const requestIdRef = useRef(0)

  useEffect(() => {
    const requestId = ++requestIdRef.current
    // Cleared rather than left standing: these two names belong to the board that was
    // selected a moment ago, and holding them through the fetch would credit this
    // board's win to the previous board's winner.
    setWinners(NO_PAST_WINNERS)

    const load = async (asked: number): Promise<void> => {
      const { winners: loaded } = await fetchPastWinners(mode, difficulty)
      if (requestIdRef.current !== asked) return
      setWinners(loaded)
    }
    void load(requestId)

    // Read again without clearing: the same board's winners stay on screen until the
    // fresh ones land, since only the spelling of a name can have moved.
    const unsubscribe = subscribeBoards((moved) => {
      if (moved !== null) return
      void load(++requestIdRef.current)
    })

    return () => {
      requestIdRef.current++
      unsubscribe()
    }
  }, [mode, difficulty])

  return winnerLines(winners)
}
