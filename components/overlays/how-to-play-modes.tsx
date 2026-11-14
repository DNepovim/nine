import { Trans, useLingui } from '@lingui/react/macro'

import { HowToPlayBody } from '@/components/overlays/how-to-play-body'
import { HowToPlayBullet } from '@/components/overlays/how-to-play-bullet'
import { HowToPlayCard } from '@/components/overlays/how-to-play-card'
import { HowToPlayModeCard } from '@/components/overlays/how-to-play-mode-card'
import { HowToPlaySectionHeader } from '@/components/overlays/how-to-play-section-header'
import { GAME_SCALE } from '@/constants/colors'
import type { SectionKey } from '@/lib/how-to-play-sections'

// The guide's MODES section — see `HowToPlayOverlay`, which lays the sections out in order.
export function HowToPlayModes({
  onMeasure,
}: {
  // Where this section's header sits in the guide's scroll, for the contents list to jump to.
  onMeasure: (section: SectionKey, y: number) => void
}) {
  const { t } = useLingui()
  return (
    <>
      <HowToPlaySectionHeader section="modes" onMeasure={onMeasure} />
      <HowToPlayBody>
        {t`Same grid, different pressure. Difficulty (Easy / Hard / Extreme) tightens the clock and adds targets.\n\nA hit is worth up to 100 points, blended from two factors and weighted by the mode:`}
      </HowToPlayBody>
      <HowToPlayCard>
        <HowToPlayBullet color={GAME_SCALE[0]}>
          <Trans>Accuracy — how close to the fewest possible moves you were.</Trans>
        </HowToPlayBullet>
        <HowToPlayBullet color={GAME_SCALE[3]}>
          <Trans>
            Speed — how much time was left on the ring. Land it with most of the ring
            intact and it pays a bonus on top.
          </Trans>
        </HowToPlayBullet>
        <HowToPlayBullet color={GAME_SCALE[4]}>
          <Trans>
            Streak — consecutive perfect plays multiply your points ×2 → ×4 → ×8. One
            imperfect hit and you start again.
          </Trans>
        </HowToPlayBullet>
      </HowToPlayCard>
      <HowToPlayBody>
        {t`\nAccuracy and Speed give you three hearts each, and lose one when a target’s ring runs out. All three gone ends the run. Trainee is unscored practice with unlimited lives, so take your time.`}
      </HowToPlayBody>
      <HowToPlayModeCard
        mode="trainee"
        facts={[
          t`Pure practice — no lives, no score, and a relaxed clock.`,
          t`Buttons can show their weight, their ceiling, and what each is giving right now — pick which from MENU during a run.`,
          t`A coach line says when a move was wasted, and what a hit cost.`,
          t`Your hit count, the last hit’s accuracy and speed, the fewest moves each target needs, and the route you should have pressed — all off until you switch them on from MENU.`,
        ]}
      />
      <HowToPlayModeCard
        mode="accuracy"
        facts={[
          t`Score rewards precision: solve each target in the fewest moves.`,
          t`On Hard and Extreme, waste too many moves on a hit and you lose a life — the bar is 20% accuracy on Hard, 15% on Extreme. Easy never takes one for it.`,
          t`Let a target’s ring run out and you lose one too — precision still has a clock.`,
          t`Matching every target in its optimal move count builds your streak.`,
          t`Targets arrive faster the longer you last, but each still gets its full ring.`,
        ]}
      />
      <HowToPlayModeCard
        mode="speed"
        facts={[
          t`A shorter clock — the sooner you hit, the more it scores.`,
          t`The clock keeps tightening as your run goes on, less and less each time.`,
          t`Hit while most of the ring is left to build your combo streak.`,
          t`A slow hit breaks the streak; let a target run out and you lose a life.`,
        ]}
      />

      <HowToPlayBody>
        {t`\nAccuracy leans almost entirely on precision; Speed on the clock. Each keeps its own streak: Accuracy wants the fewest moves, Speed wants you early on the ring.`}
      </HowToPlayBody>
    </>
  )
}
