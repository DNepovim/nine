import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { CompareOverlay } from '@/components/overlays/compare-overlay'
import { EmailDialog } from '@/components/overlays/email-dialog'
import { PlayerProfileOverlay } from '@/components/overlays/player-profile-overlay'
import type { AccountEmailFlow } from '@/hooks/use-account-email'
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
  // What the player's own card needs in order to offer them an address and a way back
  // onto another phone. Threaded through here rather than read in the card because the
  // card is drawn under this provider and the answers live above it — and because a
  // profile is public data about a player, which an address is not.
  account,
}: {
  children: ReactNode
  viewerId: string | null
  account: {
    // The confirmed address, or null for a player who has not given one.
    email: string | null
    // The whole address flow, not just its door: this provider draws the dialog as well
    // as opening it. Every other entry point — the invitation after a nickname, the
    // intro's confirm line, the one-time ask — reaches the same flow from under here, so
    // one instance up here serves all of them.
    emailFlow: AccountEmailFlow
    // Writing the nickname, for the pencil beside it on the player's own card. From auth
    // rather than from the profile read: the name is held on the session as well as on
    // the row, and one of the two going stale is how a player ends up on a board under a
    // name the app no longer thinks is theirs.
    onRename: (name: string) => Promise<{ error: string | null }>
  }
}) {
  const [userId, setUserId] = useState<string | null>(null)
  // The player being compared against, as their profile read on the card the viewer was
  // looking at. Held here rather than inside the profile modal because the comparison
  // *replaces* that modal: the two are siblings over the game, not one nested in the
  // other, which is what keeps the table the same width as the card it came from.
  //
  // The profile itself and not only an id, so the table is drawn from the very numbers the
  // player was reading a moment ago rather than from a second read that could answer
  // differently. The id rides along because a profile has never held one and the
  // comparison's header has to ask the champions whether this player holds a board — and it
  // cannot be read off `userId` below, which is cleared the moment the card behind this
  // one finishes closing.
  const [rival, setRival] = useState<{ userId: string; profile: PlayerProfile } | null>(
    null,
  )
  // Stable, so every name in the tree does not re-render when a profile opens.
  const open = useCallback((id: string) => {
    setUserId(id)
  }, [])
  const value = useMemo(() => open, [open])

  return (
    <ProfileModalContext.Provider value={value}>
      {children}
      {/* Drawn before the profile so it sits under it. Both are mounted for the length of
          one exit animation — `onCompare` fires before the card closes precisely so the
          two cross rather than the screen going bare between them — and the order is what
          makes that a cross-fade: the table is up in full behind the profile, and the
          profile fades off it. Sibling dialogs share one z-index, so this is the only
          thing deciding which of the two is on top.

          Closing this returns the player to whatever they opened the name from. The
          profile is already gone by then, and putting it back would make a table they
          have finished with into a card they have to dismiss twice. */}
      {rival !== null && viewerId !== null && (
        <CompareOverlay
          viewerId={viewerId}
          theirId={rival.userId}
          theirProfile={rival.profile}
          onClose={() => {
            setRival(null)
          }}
        />
      )}
      {userId !== null && (
        <PlayerProfileOverlay
          userId={userId}
          viewerId={viewerId}
          email={account.email}
          onOpenEmail={() => {
            // Seeded with what is on the profile, because this door is a pencil: the
            // player opening it means to change an address they can already see, not to
            // type one from nothing.
            account.emailFlow.open(account.email ?? '')
          }}
          onRename={account.onRename}
          // Left off while the sign-in has not landed: there is no viewer to compare
          // against yet, and the card reads the absence of this as "no button".
          onCompare={
            viewerId === null
              ? undefined
              : (id, profile) => {
                  setRival({ userId: id, profile })
                }
          }
          onClose={() => {
            setUserId(null)
          }}
        />
      )}
      {/* The address, and the profile its code brings back — both cards in one dialog,
          which draws its own or nothing.

          Drawn here, after the profile card, and that order is the whole reason it moved:
          the pencil beside an address used to close the profile to get out from under it,
          because two dialogs share one z-index and the one written later wins. A player
          changing their address was then sent back to the game to do it. Now it opens
          over the card it was asked for from, and closing it leaves the player where they
          were. */}
      <EmailDialog flow={account.emailFlow} />
    </ProfileModalContext.Provider>
  )
}
