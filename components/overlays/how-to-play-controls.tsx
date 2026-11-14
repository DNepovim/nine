import { useLingui } from '@lingui/react/macro'

import { HowToPlayBody } from '@/components/overlays/how-to-play-body'
import { HowToPlayCard } from '@/components/overlays/how-to-play-card'
import { HowToPlayControlsDiagram } from '@/components/overlays/how-to-play-controls-diagram'
import { HowToPlaySectionHeader } from '@/components/overlays/how-to-play-section-header'
import type { SectionKey } from '@/lib/how-to-play-sections'

// The guide's CONTROLS section — see `HowToPlayOverlay`, which lays the sections out in order.
export function HowToPlayControls({
  onMeasure,
}: {
  // Where this section's header sits in the guide's scroll, for the contents list to jump to.
  onMeasure: (section: SectionKey, y: number) => void
}) {
  const { t } = useLingui()
  return (
    <>
      <HowToPlaySectionHeader section="controls" onMeasure={onMeasure} />
      <HowToPlayCard>
        <HowToPlayControlsDiagram />
      </HowToPlayCard>
      <HowToPlayBody>
        {t`\nTap to count up — 9 wraps back to 0 — swipe down to step back one, and swipe left or right to jump straight to 0 or 9.\n\nYou can keep going without lifting your finger. Drag across the dial and each button takes the direction you leave it by, so one sweep right along a row sets all three to 9. Change your mind on a button and only the way you leave it counts, and a button only answers to a finger that really crosses it — so brushing the edge of its neighbour on the way past costs you nothing. If you would rather one gesture only ever moved the button it started on, turn off “Drag across keys” under Options. Tip: turn on “Show sum in buttons” under Options to see each button’s live contribution.\n\nThe space above the dial, where targets appear, has two shortcuts of its own: tap it twice to pause, or hold it for three seconds to restart the run on the same board.`}
      </HowToPlayBody>
    </>
  )
}
