import { useLingui } from '@lingui/react/macro'
import { useState } from 'react'
import Animated, { FadeInDown } from 'react-native-reanimated'

import { CardSection } from '@/components/overlays/card-section'
import { ProfileReignRow } from '@/components/overlays/profile-reign-row'
import { ShowMore } from '@/components/overlays/show-more'
import type { Reign } from '@/lib/player-profile'

// How many stretches the MEDALS HELD, EVER list opens on. A prolific winner carries up to
// twenty of them — day boards mostly, one per day — and a table that long buries the
// BOARDS table above it under a scroll the reader has to climb back out of. Seven is the
// last week of them, which is what a glance at this list is asking about; the rest is a
// tap away.
const SHOWN_REIGNS = 7

// How the revealed tail arrives — the comparison table's own step and fade, so a list
// unfolding here beats at the rate a table assembling there does.
const STEP_MS = 18
const FADE_MS = 200

// MEDALS HELD, EVER on a profile: the most recent stretches, and the way into the rest.
export function ProfileReigns({ reigns }: { reigns: readonly Reign[] }) {
  const { t } = useLingui()
  const [showAllReigns, setShowAllReigns] = useState(false)
  // Newest first already, so the opening slice is the most recent stretches — the ones a
  // player is most likely to still be holding, and the open one is the headline of the
  // list.
  const shownReigns = showAllReigns ? reigns : reigns.slice(0, SHOWN_REIGNS)
  const hiddenReigns = reigns.length - shownReigns.length

  return (
    <CardSection label={t`MEDALS HELD, EVER`}>
      {shownReigns.map((held, index) => (
        <Animated.View
          key={`${held.period}:${held.mode}:${held.difficulty}:${held.from}`}
          // Only what the toggle reveals arrives on an animation: the
          // rows the card opens on come up with the card, and playing
          // them in a second time underneath it would read as the list
          // rebuilding itself. The delay counts from the first revealed
          // row so the tail drops in one after another rather than as a
          // block.
          entering={
            index < SHOWN_REIGNS
              ? undefined
              : FadeInDown.delay((index - SHOWN_REIGNS) * STEP_MS).duration(FADE_MS)
          }
        >
          <ProfileReignRow
            mode={held.mode}
            difficulty={held.difficulty}
            period={held.period}
            from={held.from}
            to={held.to}
          />
        </Animated.View>
      ))}

      {/* The way into the rest of the career, and back out of it. */}
      {(hiddenReigns > 0 || showAllReigns) && (
        <ShowMore
          id="profile.show_more"
          hidden={hiddenReigns}
          expanded={showAllReigns}
          onToggle={() => {
            setShowAllReigns(!showAllReigns)
          }}
        />
      )}
    </CardSection>
  )
}
