import { useEffect, useState } from 'react'

import { loadSessionPlaces } from '@/lib/my-session-places'
import { NO_PLACES, type SessionPlaces } from '@/lib/session-places'

// The player's settled places and firsts, for the CHALLENGES achievements.
//
// Asked once there is a player, and again every time `asked` moves — the caller bumps it
// as a session run ends, since that run's score is what can have made the player first on
// a board. A place itself only settles once a window and its grace have shut, which the
// next launch picks up.
export function useSessionPlaces(userId: string | null, asked: number): SessionPlaces {
  const [places, setPlaces] = useState<SessionPlaces>(NO_PLACES)

  // No cancellation: the counts only ever grow, so an answer that lands late is never
  // worse than the one it replaces.
  useEffect(() => {
    if (userId === null) return
    void (async () => {
      const next = await loadSessionPlaces()
      if (next !== null) setPlaces(next)
    })()
  }, [userId, asked])

  return places
}
