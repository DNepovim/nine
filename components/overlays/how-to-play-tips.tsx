import { useLingui } from '@lingui/react/macro'

import { HowToPlayBullet } from '@/components/overlays/how-to-play-bullet'
import { HowToPlaySectionHeader } from '@/components/overlays/how-to-play-section-header'
import { TIPS } from '@/constants/tips'
import { SECTIONS, type SectionKey } from '@/lib/how-to-play-sections'

// The guide's TIPS section — see `HowToPlayOverlay`, which lays the sections out in order.
export function HowToPlayTips({
  onMeasure,
}: {
  // Where this section's header sits in the guide's scroll, for the contents list to jump to.
  onMeasure: (section: SectionKey, y: number) => void
}) {
  const { t } = useLingui()
  return (
    <>
      <HowToPlaySectionHeader section="tips" onMeasure={onMeasure} />
      {/* Shared with the rotating panel in Trainee's menu slot — see
        constants/tips.ts. Editing there updates both. */}
      {TIPS.map((tip, i) => (
        <HowToPlayBullet key={i} color={SECTIONS.tips.color}>
          {t(tip)}
        </HowToPlayBullet>
      ))}
    </>
  )
}
