import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { SEEN_SESSION_KEY } from '@/constants/storage'
import { useOpenSessions } from '@/hooks/use-open-sessions'
import { cardSession, type SessionCard } from '@/lib/challenge-session'
import type { OpenSession } from '@/lib/session-board'

// A live **session** this player has not been shown yet, for the launch to open its
// dialog over the intro — once per session, and never a teaser: a dialog whose button is
// dead is an interruption with nothing behind it.
//
// Reckoned against the clock as the rows land, like the intro's own card. Both read the
// launch's single list (`useOpenSessions`) and pick with `cardSession`, so the dialog the
// launch opens is the card the player would have pressed.
//
// `canSee` is handed in for the reason `useOpenSessions` gives: this is mounted in the game
// screen's own body, above `FlagsProvider`, where `useFlag` can only answer false.
export function useSessionAsk(canSee: boolean): {
  // The card to open, or null while there is nothing owed — including while storage is
  // still being read, so a session already shown is never shown twice for a frame.
  owed: Extract<SessionCard<OpenSession>, { state: 'live' }> | null
  // Records it as shown. Called by the launch as it opens the dialog, and by the player
  // pressing the card first — either way they have seen it.
  seen: (sessionId: string) => void
} {
  const sessions = useOpenSessions(canSee)
  // Undefined until storage answers; null when nothing was ever shown.
  const [seenId, setSeenId] = useState<string | null>()

  useEffect(() => {
    void (async () => {
      try {
        setSeenId(await AsyncStorage.getItem(SEEN_SESSION_KEY))
      } catch {
        // Unreadable reads as nothing shown: one dialog too many beats a session missed.
        setSeenId(null)
      }
    })()
  }, [])

  const owed = useMemo(() => {
    if (seenId === undefined) return null
    const card = cardSession(sessions, Date.now())
    return card?.state === 'live' && card.session.id !== seenId ? card : null
  }, [sessions, seenId])

  const seen = useCallback((sessionId: string) => {
    setSeenId(sessionId)
    AsyncStorage.setItem(SEEN_SESSION_KEY, sessionId).catch(() => {})
  }, [])

  return { owed, seen }
}
