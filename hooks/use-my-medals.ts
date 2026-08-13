import { useCallback, useEffect, useRef, useState } from 'react'

import { fetchMyRank } from '@/lib/leaderboard'
import { toMedals, type BoardStanding, type Medal } from '@/lib/medals'
import { DIFFICULTY_ORDER, SCORED_MODES } from '@/machines/game'

// Every board that can carry a medal: the two scored modes across the three
// difficulties. Six, so six requests — the all-time board only, which is what the RPC
// already answers. Adding today and week would triple this and wants a server-side
// round-up instead.
const BOARDS = SCORED_MODES.flatMap((mode) =>
  DIFFICULTY_ORDER.map((difficulty) => ({ mode, difficulty })),
)

// The player's all-time podium finishes, for the line under the title. Empty until
// there is a user to ask about — and it stays empty for a player with no nickname,
// since the board's ranking only counts published scores.
export function useMyMedals(userId: string | null): Medal[] {
  const [medals, setMedals] = useState<Medal[]>([])
  // Bumped on every load and unmount, so a slow response for a user who has since
  // changed can tell and drop itself.
  const requestIdRef = useRef(0)

  const load = useCallback(async (id: string) => {
    const requestId = ++requestIdRef.current
    const standings = await Promise.all(
      BOARDS.map(async ({ mode, difficulty }): Promise<BoardStanding | null> => {
        const { row } = await fetchMyRank(id, mode, difficulty, 'forever')
        return row === null
          ? null
          : { mode, difficulty, rank: row.rank, score: row.best_score }
      }),
    )
    if (requestIdRef.current !== requestId) return
    setMedals(toMedals(standings.filter((s) => s !== null)))
  }, [])

  useEffect(() => {
    if (userId === null) {
      requestIdRef.current++
      setMedals([])
      return
    }
    void load(userId)
    return () => {
      requestIdRef.current++
    }
  }, [userId, load])

  return medals
}
