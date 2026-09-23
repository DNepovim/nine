import { useEffect, useRef, useState } from 'react'

import { fetchPlayerFactors, type PlayerFactorsRow } from '@/lib/leaderboard'
import type { NameFactors } from '@/lib/name-gradient'

// Nothing known about anybody, which every consumer reads as an uncoloured name. Kept as
// one frozen instance so a component holding it in state does not re-render on each pass.
const NONE: ReadonlyMap<string, PlayerFactorsRow> = new Map()

// No ids to ask about, module-level so it is the same array every render and the effect
// below does not treat an empty request as a new one each time.
export const EMPTY_IDS: readonly string[] = []

// The empty answer, for an id nobody has asked about yet. Also module-level so the object
// identity is stable — this is handed straight to `GradientName` as props.
const UNKNOWN: NameFactors = { avgAccuracy: null, avgSpeed: null }

// What a set of players' names should be coloured by, for the surfaces that draw a name
// without a board row behind it: the player's own row below the board's cut, the intro
// greeting, and a multiplayer room's tiles.
//
// Fetched once per distinct set of ids and not kept live. A career average is a sum over
// every hit a player has ever landed, so one more run moves it by a fraction of a
// percentage point — far less than one step of colour. Re-requesting it on every score
// would be a request per run to change nothing anyone can see.
export function usePlayerFactors(
  userIds: readonly string[],
): (id: string | null) => NameFactors {
  const [factors, setFactors] = useState<ReadonlyMap<string, PlayerFactorsRow>>(NONE)
  // Bumped per request, so a slow answer for a set of ids that has since changed can
  // tell that it is stale and drop itself rather than overwriting a newer one.
  const requestIdRef = useRef(0)

  // Sorted and joined so the effect re-runs when the *membership* changes and not when
  // the array is merely rebuilt — a caller mapping over players gives us a new array
  // every render, and depending on the array itself would fetch on every one of them.
  const key = [...userIds].sort((a, b) => a.localeCompare(b)).join(',')

  useEffect(() => {
    const ids = key.length === 0 ? [] : key.split(',')
    if (ids.length === 0) {
      setFactors(NONE)
      return
    }
    const requestId = ++requestIdRef.current
    void fetchPlayerFactors(ids).then(({ factors: rows }) => {
      if (requestIdRef.current !== requestId) return
      setFactors(rows)
    })
    return () => {
      // Invalidates whatever is still in flight, so a request that lands after unmount
      // does not set state on a gone component.
      requestIdRef.current += 1
    }
  }, [key])

  // Takes null so callers can ask about a player who may not exist yet — a device with
  // no user, a room tile with nobody in it — without each of them writing the guard.
  return (id: string | null): NameFactors => {
    const row = id === null ? undefined : factors.get(id)
    if (row === undefined) return UNKNOWN
    return { avgAccuracy: row.avg_acc, avgSpeed: row.avg_spd }
  }
}
