import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { CompareOverlay } from '@/components/overlays/compare-overlay'
import { PlayerProfileOverlay } from '@/components/overlays/player-profile-overlay'
import type { PlayerProfile } from '@/lib/player-profile'

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
  // The player being compared against, as their profile read on the card the viewer was
  // looking at. Held here rather than inside the profile modal because the comparison
  // *replaces* that modal: the two are siblings over the game, not one nested in the
  // other, which is what keeps the table the same width as the card it came from.
  //
  // The profile itself and not an id, so the table is drawn from the very numbers the
  // player was reading a moment ago rather than from a second read that could answer
  // differently.
  const [rival, setRival] = useState<PlayerProfile | null>(null)
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
          // Left off while the sign-in has not landed: there is no viewer to compare
          // against yet, and the card reads the absence of this as "no button".
          onCompare={viewerId === null ? undefined : setRival}
          onClose={() => {
            setUserId(null)
          }}
        />
      )}
      {/* Both can be mounted for the length of one exit animation — the profile fading
          out while the table fades in. That overlap is the transition, not a state:
          `onCompare` fires before the card closes precisely so the two cross rather than
          the screen going bare between them.

          Closing this returns the player to whatever they opened the name from. The
          profile is already gone by then, and putting it back would make a table they
          have finished with into a card they have to dismiss twice. */}
      {rival !== null && viewerId !== null && (
        <CompareOverlay
          viewerId={viewerId}
          theirProfile={rival}
          onClose={() => {
            setRival(null)
          }}
        />
      )}
    </ProfileModalContext.Provider>
  )
}
