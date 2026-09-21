import { useCallback, useEffect, useRef, useState } from 'react'

import { fetchPlayerProfile } from '@/lib/leaderboard'
import type { PlayerProfile } from '@/lib/player-profile'

// Profiles already read this session, so reopening a name costs nothing.
//
// Safe to hold because none of it moves quickly: lifetime counters climb by one run at a
// time and a reign changes hands rarely. A profile reopened after a record fell shows the
// session's copy until the next launch, which is the trade a cache is — and the boards
// themselves, which do move, are never read from here.
const cache = new Map<string, PlayerProfile>()

export function usePlayerProfile(userId: string): {
  profile: PlayerProfile | null
  loading: boolean
  error: string | null
  reload: () => void
} {
  const [profile, setProfile] = useState<PlayerProfile | null>(
    () => cache.get(userId) ?? null,
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Bumped on every load and on unmount, so a slow response cannot land after a newer
  // one — or after the modal that asked for it has closed.
  const requestIdRef = useRef(0)

  const load = useCallback(() => {
    const id = ++requestIdRef.current
    setLoading(true)
    setError(null)
    void (async () => {
      const res = await fetchPlayerProfile(userId)
      if (requestIdRef.current !== id) return
      setLoading(false)
      if (res.profile === null) {
        // A profile that could not be read is not an empty profile. Keeping whatever was
        // shown before is why this does not clear it.
        setError(res.error ?? 'unknown error')
        return
      }
      cache.set(userId, res.profile)
      setProfile(res.profile)
    })()
  }, [userId])

  useEffect(() => {
    load()
    return () => {
      requestIdRef.current++
    }
  }, [load])

  return { profile, loading, error, reload: load }
}
