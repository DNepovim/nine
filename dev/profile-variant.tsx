import { useState } from 'react'

import { CompareOverlay } from '@/components/overlays/compare-overlay'
import { PlayerProfileOverlay } from '@/components/overlays/player-profile-overlay'
import type { PlayerProfile } from '@/lib/player-profile'

// A profile and the comparison it opens into, wired the way `PlayerProfileProvider` wires
// them in the app.
//
// The gallery mounts overlays directly rather than through the provider, and COMPARE WITH
// ME is the one thing on this card that needs somewhere to hand a profile *up* to. Without
// this the button would simply be missing from every gallery entry, which is the one state
// a gallery must not show.
export function ProfileVariant({
  userId,
  viewerId,
  onClose,
}: {
  userId: string
  viewerId: string
  onClose: () => void
}) {
  const [showingProfile, setShowingProfile] = useState(true)
  const [rival, setRival] = useState<{ userId: string; profile: PlayerProfile } | null>(
    null,
  )

  return (
    <>
      {showingProfile && (
        <PlayerProfileOverlay
          userId={userId}
          viewerId={viewerId}
          email="you@example.com"
          onOpenEmail={() => {}}
          // The gallery writes nothing. A rename here would have to go to the real row,
          // and the card is being looked at rather than used.
          onRename={() => Promise.resolve({ error: null })}
          onCompare={(id, profile) => {
            setRival({ userId: id, profile })
          }}
          onClose={() => {
            setShowingProfile(false)
            // Closed on its own, with no comparison asked for — so the variant is done.
            // Closed on the way into one and the table is already fading up behind it,
            // which is the whole point of letting both be mounted for an exit's length.
            if (rival === null) onClose()
          }}
        />
      )}
      {rival !== null && (
        <CompareOverlay
          viewerId={viewerId}
          theirId={rival.userId}
          theirProfile={rival.profile}
          onClose={onClose}
        />
      )}
    </>
  )
}
