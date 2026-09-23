import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { PlayerProfileOverlay } from '@/components/overlays/player-profile-overlay'

// Opening a profile is a function, not a screen each surface has to own.
//
// Names are drawn in a dozen places — five leaderboard rows on three screens, the
// winners stripe, multiplayer tiles, the game over board — and every one of them would
// otherwise carry its own open state and its own copy of the modal. One provider, one
// instance, one thing to close.
const ProfileModalContext = createContext<(userId: string) => void>(() => {})

// Call it with the user id the row is already carrying. A row with no id — a local score
// that has not reached the board — has no profile behind it and does not call this.
export const useOpenProfile = (): ((userId: string) => void) =>
  useContext(ProfileModalContext)

export function PlayerProfileProvider({
  children,
  // Who is looking, so a profile can tell when it is the player's own and offer them
  // their motto to write. Null until the anonymous sign-in has landed.
  viewerId,
}: {
  children: ReactNode
  viewerId: string | null
}) {
  const [userId, setUserId] = useState<string | null>(null)
  // Stable, so every name in the tree does not re-render when a profile opens.
  const open = useCallback((id: string) => {
    setUserId(id)
  }, [])
  const value = useMemo(() => open, [open])

  return (
    <ProfileModalContext.Provider value={value}>
      {children}
      {userId !== null && (
        <PlayerProfileOverlay
          userId={userId}
          viewerId={viewerId}
          onClose={() => {
            setUserId(null)
          }}
        />
      )}
    </ProfileModalContext.Provider>
  )
}
