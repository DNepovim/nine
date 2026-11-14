import { useLingui } from '@lingui/react/macro'

import { HowToPlayBody } from '@/components/overlays/how-to-play-body'
import { HowToPlaySectionHeader } from '@/components/overlays/how-to-play-section-header'
import type { SectionKey } from '@/lib/how-to-play-sections'

// The guide's TARGETS & THE CLOCK section — see `HowToPlayOverlay`, which lays the sections out in order.
export function HowToPlayTargets({
  onMeasure,
}: {
  // Where this section's header sits in the guide's scroll, for the contents list to jump to.
  onMeasure: (section: SectionKey, y: number) => void
}) {
  const { t } = useLingui()
  return (
    <>
      <HowToPlaySectionHeader section="targets" onMeasure={onMeasure} />
      <HowToPlayBody>
        {t`Each target carries a shrinking ring — its countdown. Land the sum before the ring empties. The colour behind the ring tells you the target’s hundreds at a glance: plain grey under 100, violet in the 100s, rose in the 200s, amber in the 300s — so 223 never passes for 123. A challenge played on a wider dial reaches higher numbers, and the colours keep climbing with them. Several targets can share the board at once (up to 3, or 4 on Extreme), and new ones keep arriving, so pick your order wisely. Both scored modes tighten as you go, in opposite ways. In Speed each new target arrives with a slightly shorter ring than the last. In Accuracy the ring never shrinks — you always get the full time to think — but targets start arriving closer together, so the board fills up around you. Either squeeze eases off as it goes, so a long run gets harder without ever running away from you.`}
      </HowToPlayBody>
    </>
  )
}
