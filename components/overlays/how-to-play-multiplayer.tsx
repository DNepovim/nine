import { useLingui } from '@lingui/react/macro'

import { HowToPlayBody } from '@/components/overlays/how-to-play-body'
import { HowToPlayModeCard } from '@/components/overlays/how-to-play-mode-card'
import { HowToPlaySectionHeader } from '@/components/overlays/how-to-play-section-header'
import type { SectionKey } from '@/lib/how-to-play-sections'

// The guide's MULTIPLAYER section — see `HowToPlayOverlay`, which lays the sections out in order.
export function HowToPlayMultiplayer({
  onMeasure,
}: {
  // Where this section's header sits in the guide's scroll, for the contents list to jump to.
  onMeasure: (section: SectionKey, y: number) => void
}) {
  const { t } = useLingui()
  return (
    <>
      <HowToPlaySectionHeader section="multiplayer" onMeasure={onMeasure} />
      <HowToPlayBody>
        {t`Pick “With friends” on the start screen. Create a game and share the four-digit code, or type a friend’s code to join. Two players are enough to start, and the one who created the room starts it.\n\nEveryone dials the same ten targets, one at a time, on their own grid. There are no lives — every target scores, and how it scores is the mode the host picked:`}
      </HowToPlayBody>
      {/* The same cards as the modes section, so a mode reads the same wherever
      it is met — only the badge and the facts change, because multiplayer
      keeps no lives and scores by rank rather than by points. */}
      <HowToPlayModeCard
        mode="accuracy"
        facts={[
          t`Ten seconds a target, the same one for everybody.`,
          t`Everyone who hits is ranked by how few moves it took.`,
          t`The best takes the most points; the last to land it takes none.`,
        ]}
      />
      <HowToPlayModeCard
        mode="speed"
        facts={[
          t`Seven seconds a target — the clock everyone races.`,
          t`Only the first player to land it scores.`,
          t`One point, winner takes all — everyone else gets nothing.`,
        ]}
      />
      <HowToPlayBody>
        {t`\nAfter the tenth target everyone’s score goes up on one list. The host can pick a mode and deal another game to the same room, so nobody has to swap codes again.`}
      </HowToPlayBody>
    </>
  )
}
