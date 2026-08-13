import { isOneOf } from 'narrowland'
import { useCallback, useEffect, useRef, useState } from 'react'

import { fetchMyMedals, type MyMedalRow } from '@/lib/leaderboard'
import { MEDAL_PERIODS, toMedals, type BoardStanding, type Medal } from '@/lib/medals'
import { DIFFICULTY_ORDER, SCORED_MODES } from '@/machines/game'

// The RPC answers in table columns, which are plain text — narrow them back to the
// unions before anything downstream trusts them. A row naming a board this build does
// not know about is dropped rather than rendered as a blank.
const toStanding = (row: MyMedalRow): BoardStanding | null => {
  if (!isOneOf(row.mode, SCORED_MODES)) return null
  if (!isOneOf(row.difficulty, DIFFICULTY_ORDER)) return null
  if (!isOneOf(row.period, MEDAL_PERIODS)) return null
  return {
    mode: row.mode,
    difficulty: row.difficulty,
    period: row.period,
    rank: row.rank,
    score: row.best_score,
  }
}

// The player's podium finishes, for the line under the title — every board across
// every period in one request, which is what `my_medals` exists for. Empty until
// there is a user to ask about, and it stays empty for a player with no nickname,
// since the board's ranking only counts published scores.
export function useMyMedals(userId: string | null): Medal[] {
  const [medals, setMedals] = useState<Medal[]>([])
  // Bumped on every load and unmount, so a slow response for a user who has since
  // changed can tell and drop itself.
  const requestIdRef = useRef(0)

  const load = useCallback(async (id: string) => {
    const requestId = ++requestIdRef.current
    const { rows } = await fetchMyMedals(id)
    if (requestIdRef.current !== requestId) return
    setMedals(toMedals(rows.flatMap((row) => toStanding(row) ?? [])))
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
