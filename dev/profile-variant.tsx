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
  const [rival, setRival] = useState<PlayerProfile | null>(null)

  return (
    <>
      {showingProfile && (
        <PlayerProfileOverlay
          userId={userId}
          viewerId={viewerId}
          onCompare={setRival}
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
        <CompareOverlay viewerId={viewerId} theirProfile={rival} onClose={onClose} />
      )}
    </>
  )
}
