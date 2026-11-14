import { useLingui } from '@lingui/react/macro'

import { HowToPlayBody } from '@/components/overlays/how-to-play-body'
import { HowToPlayCard } from '@/components/overlays/how-to-play-card'
import { HowToPlaySectionHeader } from '@/components/overlays/how-to-play-section-header'
import { HowToPlayWeightGrid } from '@/components/overlays/how-to-play-weight-grid'
import type { SectionKey } from '@/lib/how-to-play-sections'

// The guide's GOAL section — see `HowToPlayOverlay`, which lays the sections out in order.
export function HowToPlayGoal({
  onMeasure,
}: {
  // Where this section's header sits in the guide's scroll, for the contents list to jump to.
  onMeasure: (section: SectionKey, y: number) => void
}) {
  const { t } = useLingui()
  return (
    <>
      <HowToPlaySectionHeader section="goal" onMeasure={onMeasure} />
      <HowToPlayBody>
        {t`A glowing target number floats onto the board. Turn the nine dial buttons so the whole grid adds up to exactly that number, and the target pops — a hit.\n\nEvery button holds a digit 0–9, but where it sits decides how much it counts. Each button’s weight is its row order × its column order — rows numbered 1–3 top to bottom, columns 1–3 left to right — so it adds row × column × value to the total.`}
      </HowToPlayBody>
      <HowToPlayCard>
        <HowToPlayWeightGrid />
      </HowToPlayCard>
      <HowToPlayBody>
        {t`\nSo the bottom-right button (row 3 × column 3 = 9) moves the total in big leaps, while the top-left (1 × 1 = 1) nudges it by exactly its digit — perfect for fine-tuning the last few points.`}
      </HowToPlayBody>
    </>
  )
}
