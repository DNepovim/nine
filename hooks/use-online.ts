import { useEffect, useSyncExternalStore } from 'react'

import { isOnline, setOnline, subscribeOnline } from '@/lib/connectivity'
import { watchNetwork } from '@/lib/net-watch'

// Whether the leaderboard is reachable. Answered by the outcome of the requests the
// app already makes, plus whatever the platform volunteers — see lib/connectivity.ts.
export function useOnline(): boolean {
  const online = useSyncExternalStore(subscribeOnline, isOnline, isOnline)

  useEffect(() => watchNetwork(setOnline), [])

  return online
}
