import { isOneOf } from 'narrowland'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useLocalScores } from '@/hooks/use-local-scores'
import type { BoardRef } from '@/lib/board-events'
import { subscribeBoards } from '@/lib/board-live'
import { fetchMyMedals, type MyMedalRow } from '@/lib/leaderboard'
import { MEDAL_PERIODS, toMedals, type BoardStanding, type Medal } from '@/lib/medals'
import { DIFFICULTY_ORDER, SCORED_MODES } from '@/machines/game'

// A run touches every board the player holds at once, and one request answers for all
// of them. Longer than the board's own window: this line is never mid-run urgent.
const COALESCE_MS = 800

const keyOf = (board: BoardRef | { mode: string; difficulty: string }): string =>
  `${board.mode}:${board.difficulty}`

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
//
// Kept live off the app's one board connection, but only for boards the player actually
// stands on. A medal is a standing across all six boards, so watching just the one being
// played would miss a rival taking a gold elsewhere — while watching *every* board meant
// this whole request fired for every score anyone posted anywhere, to keep three emoji
// current. The boards that matter are the ones the last response named, plus any the
// device holds a score on, which covers a first-ever score on a new board.
export function useMyMedals(userId: string | null): Medal[] {
  const [medals, setMedals] = useState<Medal[]>([])
  // Bumped on every load and unmount, so a slow response for a user who has since
  // changed can tell and drop itself.
  const requestIdRef = useRef(0)
  // The boards the last response put the player on. Read by the subscription without
  // being one of its dependencies, so a refetch never re-subscribes.
  const heldRef = useRef(new Set<string>())

  const localScores = useLocalScores()
  const localBoardsRef = useRef(new Set<string>())
  localBoardsRef.current = new Set(localScores.map(keyOf))

  const load = useCallback(async (id: string) => {
    const requestId = ++requestIdRef.current
    const { rows } = await fetchMyMedals(id)
    if (requestIdRef.current !== requestId) return
    heldRef.current = new Set(rows.map(keyOf))
    setMedals(toMedals(rows.flatMap((row) => toStanding(row) ?? [])))
  }, [])

  useEffect(() => {
    if (userId === null) {
      requestIdRef.current++
      heldRef.current = new Set()
      setMedals([])
      return
    }
    void load(userId)

    // One request answers every board, so a burst of events is worth collecting before
    // asking — and unlike the board itself this line is never mid-run urgent.
    let coalesce: ReturnType<typeof setTimeout> | undefined
    const unsubscribe = subscribeBoards((moved) => {
      // A move we cannot attribute is a gap we cannot see into, so it always counts.
      if (moved !== null) {
        const key = keyOf(moved)
        if (!heldRef.current.has(key) && !localBoardsRef.current.has(key)) return
      }
      clearTimeout(coalesce)
      coalesce = setTimeout(() => void load(userId), COALESCE_MS)
    })

    return () => {
      requestIdRef.current++
      clearTimeout(coalesce)
      unsubscribe()
    }
  }, [userId, load])

  return medals
}
