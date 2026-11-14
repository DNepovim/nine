import { Trans, useLingui } from '@lingui/react/macro'

import { HowToPlayBody } from '@/components/overlays/how-to-play-body'
import { HowToPlayBullet } from '@/components/overlays/how-to-play-bullet'
import { HowToPlayCard } from '@/components/overlays/how-to-play-card'
import { HowToPlaySectionHeader } from '@/components/overlays/how-to-play-section-header'
import { MarkGlyph } from '@/components/player-mark'
import { GAME_SCALE } from '@/constants/colors'
import { PHOENIX_MARK } from '@/lib/champions'
import type { SectionKey } from '@/lib/how-to-play-sections'
import { gradientOf } from '@/modes'

// The guide's CHAMPIONS section — see `HowToPlayOverlay`, which lays the sections out in order.
export function HowToPlayChampions({
  onMeasure,
}: {
  // Where this section's header sits in the guide's scroll, for the contents list to jump to.
  onMeasure: (section: SectionKey, y: number) => void
}) {
  const { t } = useLingui()
  return (
    <>
      <HowToPlaySectionHeader section="champions" onMeasure={onMeasure} />
      <HowToPlayBody>
        {t`Three standings carry a mark: the all-time record on each mode’s Extreme board, and the last challenge. A mark travels with your name everywhere it is drawn — the boards, your own row, a multiplayer room — so the hardest standings say who holds them without anyone having to look them up.`}
      </HowToPlayBody>
      <HowToPlayCard>
        <HowToPlayBullet color={gradientOf('accuracy')[0]}>
          <Trans>
            🦉 The owl is Accuracy at its hardest. That board rewards the exact route, and
            the owl is the eye that finds it.
          </Trans>
        </HowToPlayBullet>
        <HowToPlayBullet color={gradientOf('speed')[0]}>
          <Trans>
            🦅 The eagle is Speed at its hardest, for the dive rather than the search.
          </Trans>
        </HowToPlayBullet>
        <HowToPlayBullet color={GAME_SCALE[3]}>
          <Trans>
            <MarkGlyph mark={PHOENIX_MARK} size={13} inline /> The phoenix is whoever took
            the last challenge. It is the one mark that is not a board, and it moves on
            the day the next session ends.
          </Trans>
        </HowToPlayBullet>
        <HowToPlayBullet color={GAME_SCALE[4]}>
          <Trans>
            👑 The crown is all three at once — the rarest thing in the game, and the only
            way to wear one mark instead of three.
          </Trans>
        </HowToPlayBullet>
      </HowToPlayCard>
      <HowToPlayBody>
        {t`\nA mark is only ever lent. Take somebody’s record and it moves to you; lose yours and it leaves with the board.`}
      </HowToPlayBody>
    </>
  )
}
