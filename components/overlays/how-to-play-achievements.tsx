import { Trans, useLingui } from '@lingui/react/macro'

import { HowToPlayBody } from '@/components/overlays/how-to-play-body'
import { HowToPlayBullet } from '@/components/overlays/how-to-play-bullet'
import { HowToPlayCard } from '@/components/overlays/how-to-play-card'
import { HowToPlaySectionHeader } from '@/components/overlays/how-to-play-section-header'
import { ACHIEVEMENT_SCALE } from '@/constants/colors'
import type { SectionKey } from '@/lib/how-to-play-sections'

// The guide's ACHIEVEMENTS section — see `HowToPlayOverlay`, which lays the sections out in order.
export function HowToPlayAchievements({
  onMeasure,
}: {
  // Where this section's header sits in the guide's scroll, for the contents list to jump to.
  onMeasure: (section: SectionKey, y: number) => void
}) {
  const { t } = useLingui()
  return (
    <>
      <HowToPlaySectionHeader section="achievements" onMeasure={onMeasure} />
      <HowToPlayBody>
        {t`Achievements are the other kind. Nothing can take one back: they are achieved once and yours for good, and they are measured against you rather than against anybody else — so they are there to be collected whether or not your score is ever good enough for a board.\n\nThere are dozens, and they ask for all sorts of things.`}
      </HowToPlayBody>
      <HowToPlayCard>
        <HowToPlayBullet color={ACHIEVEMENT_SCALE[3]}>
          <Trans>
            Scores, one ladder per mode — Accuracy and Speed ask for opposite things, so
            each has its own rungs to climb.
          </Trans>
        </HowToPlayBullet>
        <HowToPlayBullet color={ACHIEVEMENT_SCALE[3]}>
          <Trans>
            Skill inside a single run: a long streak, the top multiplier, a stretch
            without losing a life.
          </Trans>
        </HowToPlayBullet>
        <HowToPlayBullet color={ACHIEVEMENT_SCALE[3]}>
          <Trans>
            Sticking with it — targets landed across every run you have ever played, and
            days played in a row.
          </Trans>
        </HowToPlayBullet>
        <HowToPlayBullet color={ACHIEVEMENT_SCALE[3]}>
          <Trans>A stack of them nobody is told about until they happen.</Trans>
        </HowToPlayBullet>
      </HowToPlayCard>
      <HowToPlayBody>
        {t`\nAchieve one mid-run and the score bar says so in green — tap that line and the run pauses so you can read what the achievement asked of you. Most are asked once per difficulty — Easy, Hard and Extreme count separately, and the list draws a bar for each. The whole list is behind the achievements line under NINE on the start screen, along with how far along you are on the ones you have not got yet.`}
      </HowToPlayBody>
    </>
  )
}
